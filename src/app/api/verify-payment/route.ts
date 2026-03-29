import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { order_id } = await req.json();

    if (!order_id) {
      return NextResponse.json({ error: 'Missing order_id' }, { status: 400 });
    }

    const appId = process.env.CASHFREE_APP_ID;
    const secretKey = process.env.CASHFREE_SECRET_KEY;
    const isProd = process.env.CASHFREE_ENV === 'PRODUCTION';

    const endpoint = isProd 
       ? `https://api.cashfree.com/pg/orders/${order_id}`
       : `https://sandbox.cashfree.com/pg/orders/${order_id}`;

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'x-client-id': appId || '',
        'x-client-secret': secretKey || '',
        'x-api-version': '2023-08-01',
        'Accept': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Cashfree Verification Error:", data);
      return NextResponse.json({ error: data.message || 'Verification Failed' }, { status: response.status });
    }

    // Verify the status of the order transaction with Cashfree
    if (data.order_status === 'PAID') {
       
       // Lookup the pending deposit entry matching the order_id (stored via utr_number wrapper)
       const { data: deposit, error: depError } = await supabase
         .from('deposits')
         .select('*')
         .eq('utr_number', order_id)
         .eq('status', 'PENDING')
         .single();
         
       if (depError || !deposit) {
         return NextResponse.json({ error: 'Order already resolved or not found in Local Database' }, { status: 400 });
       }

       // ✅ PAYMENT CONFIRMED! Add balance!
       
       // 1. Mark deposit as APPROVED
       await supabase.from('deposits').update({ 
         status: 'APPROVED', 
         resolved_at: new Date().toISOString() 
       }).eq('id', deposit.id);
       
       // 2. Add amount direct to User's Profile Balance
       const { data: profile, error: profErr } = await supabase
         .from('profiles')
         .select('balance')
         .eq('telegram_id', deposit.telegram_id)
         .single();
         
       if (!profErr && profile) {
          await supabase.from('profiles').update({ 
            balance: profile.balance + deposit.amount 
          }).eq('telegram_id', deposit.telegram_id);
       }

       return NextResponse.json({ success: true, message: 'Payment verified and successfully credited!' }, { status: 200 });

    } else {
       // Payment is ACTIVE, FAILED, or CANCELLED, not successfully paid.
       return NextResponse.json({ error: `Payment state is currently: ${data.order_status}` }, { status: 400 });
    }

  } catch (error: any) {
    console.error("Payment Verification API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
