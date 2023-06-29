import { expect } from "chai";
import { ethers } from "hardhat";
import { DeepLink } from "../typechain-types";
  
describe("DeepLink", function () {
    let deepLink: DeepLink;
    let owner: any;
    let addr1: any;
    let addr2: any;
    let metadataURI: any;

    beforeEach(async () => {
        const DeepLink = await ethers.getContractFactory("DeepLink");
        [owner, addr1, addr2] = await ethers.getSigners();
        deepLink = await DeepLink.deploy();
        metadataURI = "https://example.com/metadata";
    });

    describe("Deployment", function () {
        it("Should set the correct token name and symbol", async function () {
        expect(await deepLink.name()).to.equal("DeepLink");
        expect(await deepLink.symbol()).to.equal("DLI");
        });
    });

    describe("Minting", function () {
        it("Should mint a new token with the correct owner and metadata URI", async function () {
        await deepLink.connect(owner).mintToken(addr1.address, metadataURI);

        expect(await deepLink.ownerOf(1)).to.equal(addr1.address);
        expect(await deepLink.tokenURI(1)).to.equal(metadataURI);
        });

        it("Should increment the token ID after each mint", async function () {
        await deepLink.connect(owner).mintToken(addr1.address, metadataURI);
        await deepLink.connect(owner).mintToken(addr2.address, metadataURI);

        expect(await deepLink.balanceOf(addr1.address)).to.equal(1);
        expect(await deepLink.balanceOf(addr2.address)).to.equal(1);
        expect(await deepLink.ownerOf(1)).to.equal(addr1.address);
        expect(await deepLink.ownerOf(2)).to.equal(addr2.address);
        });
    });
});