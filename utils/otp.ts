
/**
 * Utility to simulate sending OTP to a mobile number.
 * In a real application, this would call an SMS gateway API like Twilio.
 */
export const sendOTP = async (phone: string, code: string): Promise<boolean> => {
  console.log(`[OTP SERVICE] Requesting OTP for ${phone}`);
  
  try {
    const response = await fetch('/api/otp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[OTP SERVICE] Backend Error:', errorData.error);
      return false;
    }

    const data = await response.json();
    
    // If simulated, we still show the toast for the demo
    if (data.mode === 'simulated') {
      const event = new CustomEvent('otp-sent', { 
        detail: { phone, code } 
      });
      window.dispatchEvent(event);
    }

    return true;
  } catch (error) {
    console.error('[OTP SERVICE] Fetch Error:', error);
    return false;
  }
};

export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};
