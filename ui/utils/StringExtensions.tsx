declare global {
  interface String {
    toPascalCase(): string;
  }
}

String.prototype.toPascalCase = function () {
  return String(this)
    .split(/[^a-zA-Z0-9]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
};

export {};
