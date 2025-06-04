const bcrypt = require('bcrypt');

async function testBcrypt() {
  const password = "123456";
  const hash = await bcrypt.hash(password, 12);
  console.log("Hash:", hash);
  const isValid = await bcrypt.compare(password, hash);
  console.log("Comparaison:", isValid);
}

testBcrypt();