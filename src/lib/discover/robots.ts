export function parseRobots(text: string): string[] {
  const rules: string[] = [];
  let applies = false;
  let sawAnyAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split('#')[0]?.trim() ?? '';
    if (!line) continue;
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === 'user-agent') {
      if (sawAnyAgent && applies && value !== '*') applies = false;
      if (value === '*') {
        applies = true;
        sawAnyAgent = true;
      } else if (!sawAnyAgent) {
        applies = false;
      }
      continue;
    }
    if (applies && key === 'disallow' && value) rules.push(value);
  }
  return rules;
}

export function isDisallowed(pathname: string, rules: string[]): boolean {
  return rules.some((rule) => {
    if (rule === '/') return true;
    return rule !== '' && pathname.startsWith(rule);
  });
}
