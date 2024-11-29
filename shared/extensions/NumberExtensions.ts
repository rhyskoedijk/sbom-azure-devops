declare global {
  interface Number {
    toOridinal(): string;
  }
}

Number.prototype.toOridinal = function (): string {
  const i = Number(this);
  const j = i % 10;
  const k = i % 100;
  if (j === 1 && k !== 11) {
    return 'st';
  }
  if (j === 2 && k !== 12) {
    return 'nd';
  }
  if (j === 3 && k !== 13) {
    return 'rd';
  }
  return 'th';
};

export {};
