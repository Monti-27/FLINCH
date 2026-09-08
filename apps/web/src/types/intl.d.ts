declare namespace Intl {
  interface NumberFormat {
    formatToParts(value?: number | bigint | string): NumberFormatPart[];
  }
}
