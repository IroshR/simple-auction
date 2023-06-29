import { expect } from "chai";
import { ethers } from "hardhat";
import { Auction, DeepLink } from "../typechain-types";

async function getTime(){
    const blockNumBefore = await ethers.provider.getBlockNumber();
    const blockBefore = await ethers.provider.getBlock(blockNumBefore);
    return blockBefore?.timestamp || 0;
};

describe("Auction", function () {
    let deepLink: DeepLink;
    let auction: Auction;
    let owner: any;
    let participant1: any;
    let participant2: any;
    let metadataURI: any;
  
    beforeEach(async function () {
        [owner, participant1, participant2] = await ethers.getSigners();
    
        const DeepLink = await ethers.getContractFactory("DeepLink");
        deepLink = await DeepLink.deploy();

        const Auction = await ethers.getContractFactory("Auction");
        auction = await Auction.deploy();
        metadataURI = "https://example.com/metadata";
        
    
        await deepLink.mintToken(owner.address, metadataURI);
    });

    describe("Listing", async function () {
        it("should revert if not approved to list", async function () {
            await expect(auction.list(deepLink.getAddress(), 1, 10, 1)).to.be.reverted;
        });
      
        it("should revert if not owner of nft", async function () {
            await expect(auction.connect(participant1).list(deepLink.getAddress(), 1, 10, 1)).to.be
              .reverted;
        });
      
        it("should allow listing nft", async function () {
            await deepLink.approve(auction.getAddress(), 1);
            await expect(auction.list(deepLink.getAddress(), 1, 10, 1)).to.emit(
                auction,
                "List"
            );
        });
      
        it("should allow listing 2nd nft", async function () {
            await deepLink.mintToken(owner.address, metadataURI);
            await deepLink.approve(auction.getAddress(), 2);
            await expect(auction.list(deepLink.getAddress(), 2, 100, 2)).to.emit(
                auction,
                "List"
            );
        });
    });

    describe("Bid", async function () {
        it("should not allow bid below min price", async function () {
            await deepLink.approve(auction.getAddress(), 1);
            await auction.list(deepLink.getAddress(), 1, 10, 1);
            await expect(auction.connect(participant1).bid(0, { value: 9 })).to.be.revertedWith('you must bid at least the min price');
        });
      
        it("should not allow bid on auction that doesn't exist", async function () {
            await deepLink.approve(auction.getAddress(), 1);
            await auction.list(deepLink.getAddress(), 1, 10, 1);
            await expect(auction.connect(participant1).bid(9, { value: 1000 })).to.be.revertedWith('listing does not exist');
        });
      
        it("should allow valid bid", async function () {
            await deepLink.approve(auction.getAddress(), 1);
            await auction.list(deepLink.getAddress(), 1, 10, 1);
            await expect(auction.connect(participant1).bid(0, { value: 15 })).to.emit(
               auction,
               "Bid"
            );
            const [
                nftContract,
                nftId,
                highestBid,
                minPrice,
            ] = await auction.getListing(0);
            expect(nftContract).to.equal(await deepLink.getAddress());
            expect(nftId).to.equal(1);
            expect(highestBid).to.equal(15);
            expect(minPrice).to.equal(10);
        });
      
        it("should not allow bid that is less than highest bid", async function () {
            await deepLink.approve(auction.getAddress(), 1);
            await auction.list(deepLink.getAddress(), 1, 10, 1);
            auction.connect(participant2).bid(0, { value: 15 });
            await expect(auction.connect(participant2).bid(0, { value: 11 })).to.be.revertedWith('you must bid higher than the current highest bid');
        });
      
        it("should allow valid bid that is higher than highest bid", async function () {
            await deepLink.approve(auction.getAddress(), 1);
            await auction.list(deepLink.getAddress(), 1, 10, 1);
            await expect(auction.connect(participant2).bid(0, { value: 50 })).to.emit(
                auction,
                "Bid"
            );
            const [
                nftContract,
                nftId,
                highestBid,
                minPrice,
            ] = await auction.getListing(0);
            expect(nftContract).to.equal(await deepLink.getAddress());
            expect(nftId).to.equal(1);
            expect(highestBid).to.equal(50);
            expect(minPrice).to.equal(10);
        });
      
        it("should not allow bid on auction that is completed", async function () {
            await deepLink.approve(auction.getAddress(), 1);
            await auction.list(deepLink.getAddress(), 1, 10, 1);
            await ethers.provider.send("evm_mine", [(await getTime()) + 3600]);
            await expect(auction.connect(participant1).bid(0, { value: 1000000 })).to.be.revertedWith('auction is over');
        });
    });

    describe("Withdraw Funds", async function () {
        it("previous bidders can withdraw their funds", async function () {
            await deepLink.approve(auction.getAddress(), 1);
            await auction.list(deepLink.getAddress(), 1, 10, 1);
            await auction.connect(participant1).bid(0, { value: 15 });
            await auction.connect(participant2).bid(0, { value: 25 });
            await auction.connect(participant1).bid(0, { value: 27 });

            await expect(
                await auction.connect(participant2).withdrawFunds()
            ).to.changeEtherBalances([participant2, auction], [25, -25]);
        });
      
        it("current highest bidder cannot withdraw their funds", async function () {
            await deepLink.approve(auction.getAddress(), 1);
            await auction.list(deepLink.getAddress(), 1, 10, 1);
            await auction.connect(participant1).bid(0, { value: 15 });
            await auction.connect(participant2).bid(0, { value: 25 });

            await expect(
                await auction.connect(participant2).withdrawFunds()
            ).to.changeEtherBalances([participant2, auction], [0, 0]);
        });
      
        it("owner cannot withdraw their funds until end() is called", async function () {
            await expect(
                await auction.connect(owner).withdrawFunds()
            ).to.changeEtherBalances([owner, auction], [0, 0]);
        });
    });

    describe("End", async function () {
        it("Cannot call end if auction is not completed", async function () {
            await deepLink.approve(auction.getAddress(), 1);
            await auction.list(deepLink.getAddress(), 1, 10, 1);
            await expect(auction.end(0)).to.be.revertedWith('auction is not over');
        });
      
        it("can call end on finished listing - should transfer nft", async function () {
            await deepLink.approve(auction.getAddress(), 1);
            await auction.list(deepLink.getAddress(), 1, 10, 1);
            auction.connect(participant2).bid(0, { value: 15 });
            await ethers.provider.send("evm_mine", [(await getTime()) + 3600]);
            await auction.end(0);
            expect(await deepLink.ownerOf(1)).to.equal(await participant2.getAddress());
        });
      
        it("Cannot call end twice", async function () {
            await deepLink.approve(auction.getAddress(), 1);
            await auction.list(deepLink.getAddress(), 1, 10, 1);
            auction.connect(participant2).bid(0, { value: 15 });
            await ethers.provider.send("evm_mine", [(await getTime()) + 3600]);
            await auction.end(0);
            await expect(auction.end(0)).to.be.revertedWith('listing does not exist');
        });

        it("auction winner cannot withdraw funds once the auctions is done", async function () {
            await deepLink.approve(auction.getAddress(), 1);
            await auction.list(deepLink.getAddress(), 1, 10, 1);
            auction.connect(participant1).bid(0, { value: 15 });
            auction.connect(participant2).bid(0, { value: 50 });
            await ethers.provider.send("evm_mine", [(await getTime()) + 3600]);
            await auction.end(0);
            await expect(
                await auction.connect(participant2).withdrawFunds()
            ).to.changeEtherBalances([participant2, auction], [0, 0]);
        });
        
        it("listing owner can withdraw funds once the auctions is done", async function () {
            await deepLink.approve(auction.getAddress(), 1);
            await auction.list(deepLink.getAddress(), 1, 10, 1);
            auction.connect(participant1).bid(0, { value: 15 });
            auction.connect(participant2).bid(0, { value: 50 });
            await ethers.provider.send("evm_mine", [(await getTime()) + 3600]);
            await auction.end(0);
            await expect(
                await auction.connect(owner).withdrawFunds()
            ).to.changeEtherBalances([owner, auction], [50, -50]);
        });
    });
});