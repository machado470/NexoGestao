export function cpfIsValid(cpf: string): boolean {
  const numbers = (cpf || "").replace(/\D/g, "");
  if (numbers.length !== 11) return false;

  const calc = (size: number) => {
    let sum = 0;
    let pos = size + 1;

    for (let i = 0; i < size; i++) {
      const n = Number(numbers.charAt(i));
      sum += n * pos--;
    }

    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  const d1 = calc(9);
  const d2 = (() => {
    let sum = 0;
    let pos = 11;
    for (let i = 0; i < 10; i++) {
      const n = Number(numbers.charAt(i));
      sum += n * pos--;
    }
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  })();

  return d1 === Number(numbers.charAt(9)) && d2 === Number(numbers.charAt(10));
}
