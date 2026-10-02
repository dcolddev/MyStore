import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all products
    const { data: allProducts, error: productsError } = await supabaseClient
      .from('products')
      .select(`
        id,
        name,
        quantity,
        reorder_level,
        store_id,
        stores!inner(
          name,
          owner_id,
          profiles!inner(
            full_name,
            id
          )
        )
      `);
    
    if (productsError) throw productsError;

    // Filter products that are at or below reorder level
    const lowStockProducts = allProducts?.filter(
      (product) => product.quantity <= product.reorder_level
    ) || [];

    if (!lowStockProducts || lowStockProducts.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No low stock products found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Group products by owner
    const productsByOwner = lowStockProducts.reduce((acc: any, product: any) => {
      const ownerId = product.stores.owner_id;
      if (!acc[ownerId]) {
        acc[ownerId] = {
          ownerName: product.stores.profiles.full_name || 'Store Owner',
          ownerId: ownerId,
          products: []
        };
      }
      acc[ownerId].products.push({
        name: product.name,
        storeName: product.stores.name,
        currentStock: product.quantity,
        reorderLevel: product.reorder_level
      });
      return acc;
    }, {});

    // Send email to each owner
    const emailPromises = Object.values(productsByOwner).map(async (owner: any) => {
      // Get owner's email from auth.users
      const { data: { user }, error: userError } = await supabaseClient.auth.admin.getUserById(owner.ownerId);
      
      if (userError || !user?.email) {
        console.error(`Failed to get email for owner ${owner.ownerId}:`, userError);
        return null;
      }

      const productsList = owner.products
        .map((p: any) => `• ${p.name} (${p.storeName}): ${p.currentStock} units remaining (reorder at ${p.reorderLevel})`)
        .join('\n');

      const emailHtml = `
        <h2>Low Stock Alert</h2>
        <p>Hello ${owner.ownerName},</p>
        <p>The following products in your store(s) are running low on stock:</p>
        <pre style="font-family: monospace; background: #f5f5f5; padding: 15px; border-radius: 5px;">
${productsList}
        </pre>
        <p>Please restock these items soon to avoid running out.</p>
        <p>Best regards,<br>Your Store Management System</p>
      `;

      // Send email using Supabase Auth
      const { error: emailError } = await supabaseClient.auth.admin.inviteUserByEmail(user.email, {
        data: {
          subject: '⚠️ Low Stock Alert',
          html: emailHtml
        }
      });

      if (emailError) {
        console.error(`Failed to send email to ${user.email}:`, emailError);
        return { success: false, email: user.email, error: emailError.message };
      }

      return { success: true, email: user.email, productsCount: owner.products.length };
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter((r) => r?.success).length;

    return new Response(
      JSON.stringify({
        message: `Processed ${lowStockProducts.length} low stock products for ${Object.keys(productsByOwner).length} owners`,
        emailsSent: successCount,
        results: results.filter(r => r !== null)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
