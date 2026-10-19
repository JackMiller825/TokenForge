const UNSAFE = /wallet|connect|buy|swap|purchase|mint|stake|approve|sign\b|checkout|\bpay\b|subscribe|log\s?in|register|\bsubmit\b|transaction|metamask|phantom|solflare/i;

export function isUnsafeInteraction(label: string, inputType: string | null, insideForm: boolean): boolean {
  if (insideForm) return true;
  if (inputType && inputType.toLowerCase() === 'submit') return true;
  return UNSAFE.test(label);
}
