import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Helper to generate unique order ID
const generateOrderId = (userId: string | number) => `CRICP_DEP_${userId}_${Date.now()}`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { amount, telegram_id, customer_phone = '9999999999' } = body;

    if (!amount || !telegram_id) {
      return NextResponse.json({ error: 'Missing amount or telegram_id' }, { status: 400 });
    }

    const orderId = generateOrderId(telegram_id);
    const appId = process.env.CASHFREE_APP_ID;
    const secretKey = process.env.CASHFREE_SECRET_KEY;
    const isProd = process.env.CASHFREE_ENV === 'PRODUCTION';

    // Since the user provided PROD keys, we use the Live endpoint
    const endpoint = isProd 
       ? 'https://api.cashfree.com/pg/orders' 
       : 'https://sandbox.cashfree.com/pg/orders';

    const orderPayload = {
      order_id: orderId,
      order_amount: amount,
      order_currency: 'INR',
      customer_details: {
        customer_id: `TG_${telegram_id}`,
        customer_phone: customer_phone,
      },
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'x-client-id': appId || '',
        'x-client-secret': secretKey || '',
        'x-api-version': '2023-08-01',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(orderPayload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Cashfree Error:", data);
      return NextResponse.json({ error: data.message || 'Failed to create order' }, { status: response.status });
    }

    // Insert pending order in local DB so we can cross-verify it later
    const { error: dbError } = await supabase
      .from('deposits')
      .insert({
        telegram_id: telegram_id,
        amount: amount,
        utr_number: orderId, // Repurposing utr_number to store the Order ID temporarily
        status: 'PENDING'
      });

    if (dbError) {
      console.error("DB Insert Error:", dbError);
      return NextResponse.json({ error: 'Failed to queue order internally' }, { status: 500 });
    }

    // Send back the payment_session_id required by the JS SDK
    return NextResponse.json({ 
      payment_session_id: data.payment_session_id,
      order_id: orderId 
    }, { status: 200 });

  } catch (error: any) {
    console.error("Payment API Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
