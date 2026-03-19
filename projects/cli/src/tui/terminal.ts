/** biome-ignore-all lint/suspicious/noConsole: default */
class Terminal {
  print(message?: unknown, ...optionalParams: unknown[]): void {
    console.log(message, ...optionalParams);
  }
  error(message?: unknown, ...optionalParams: unknown[]): void {
    console.error(message, ...optionalParams);
  }
  clear(): void {
    // ? I'm not yet sure if full reset is what should be done...
    // ? console.clear() is probably the less obtrusive decision
    // \x1B[2J Clears the visible screen area.
    // \x1B[3J Clears the terminal's scrollback buffer (history).
    // \x1B[H Moves the cursor back to the top-left corner (home position).
    // process.stdout.write('\x1B[2J\x1B[3J\x1B[H');
    console.clear();
  }
  clearAndPrint(message?: unknown, ...optionalParams: unknown[]): void {
    this.clear();
    const hasOptional = optionalParams && optionalParams.length > 0;
    if (hasOptional) this.print(message, optionalParams);
    else this.print(message);
  }
}

export const terminal: Terminal = new Terminal();
