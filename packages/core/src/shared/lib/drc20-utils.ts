function is4Byte(ticker: string) {
  return Buffer.from(ticker).length === 4;
}

function is5Byte(ticker: string) {
  return Buffer.from(ticker).length === 5;
}

export const drc20Utils = {
  is4Byte,
  is5Byte
};
