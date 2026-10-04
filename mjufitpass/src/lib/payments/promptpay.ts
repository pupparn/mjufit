import generatePayload from "promptpay-qr";
import QRCode from "qrcode";

/** EMVCo PromptPay payload with the amount locked in. */
export function promptPayPayload(promptPayId: string, amountSatang: number): string {
  return generatePayload(promptPayId, { amount: amountSatang / 100 });
}

export function promptPayQrSvg(promptPayId: string, amountSatang: number): Promise<string> {
  return QRCode.toString(promptPayPayload(promptPayId, amountSatang), {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
  });
}
