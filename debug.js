const Moralis = require('moralis').default;
require('dotenv').config();

async function debug() {
  await Moralis.start({ apiKey: process.env.MORALIS_API_KEY });
  
  const response = await Moralis.EvmApi.nft.getNFTMetadata({
    chain: "0x1",
    address: "0xbd3531da5cf5857e7cfaa92426877b022e612cf8",
    tokenId: "6878",
    normalizeMetadata: true,
  });
  
  const nft = response.result;
  console.log("NFT Name:", nft.name);
  console.log("Symbol:", nft.symbol);
  console.log("Metadata:", JSON.stringify(nft.metadata, null, 2));
}

debug().catch(console.error);