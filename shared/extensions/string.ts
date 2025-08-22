declare global {
  interface String {
    toPascalCase(): string;
    truncate(maxLength: number): string;
  }
}

String.prototype.toPascalCase = function (): string {
  return String(this)
    .split(/[^a-zA-Z0-9]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
};

String.prototype.truncate = function (maxLength: number): string {
  if (this.length <= maxLength) {
    return String(this);
  }
  return String(this).slice(0, maxLength - 3) + '...';
};

export {};
