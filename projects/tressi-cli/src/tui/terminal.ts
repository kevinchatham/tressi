/* eslint-disable no-console */
class Terminal {
  print(message?: unknown, ...optionalParams: unknown[]): void {
    const hasOptional = optionalParams && optionalParams.length > 0;
    if (hasOptional) console.log(message, optionalParams);
    else console.log(message);
  }
  clear(): void {
    process.stdout.write('\x1B[2J\x1B[3J\x1B[H');
  }
  clearAndPrint(message?: unknown, ...optionalParams: unknown[]): void {
    this.clear();
    const hasOptional = optionalParams && optionalParams.length > 0;
    if (hasOptional) this.print(message, optionalParams);
    else this.print(message);
  }
}

export const terminal = new Terminal();
