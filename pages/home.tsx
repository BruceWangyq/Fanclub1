import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

// import thirdweb
import { useWeb3 } from "@3rdweb/hooks";
import { ThirdwebSDK } from "@3rdweb/sdk";

import { followListInfoQuery, searchUserInfoQuery } from "../src/utils/query";
import {
  FollowListInfoResp,
  SearchUserInfoResp,
  Network,
} from "../src/utils/types";
import {
  formatAddress,
  removeDuplicate,
  isValidAddr,
} from "../src/utils/helper";

import { useThirdWeb } from "../src/context/thirdwebContext";
import { HeaderLink } from "../src/components/HeaderLink";
import LoadingButton from "@mui/lab/LoadingButton";

const NAME_SPACE = "CyberConnect";
const NETWORK = Network.ETH;
const SEARCHADDRESS = "0x148d59faf10b52063071eddf4aaf63a395f2d41c";

// const sdk = new ThirdwebSDK("rinkeby");
const Home = () => {
  // Use the connectWallet hook thirdweb gives us.
  const { connectWallet, error, provider } = useWeb3();

  const { sdk, whitelist, updateWhitelist, bundleDrop, cyberConnect, address } =
    useThirdWeb();
  console.log("👋 Address:", address);

  const [searchAddrInfo, setSearchAddrInfo] =
    useState<SearchUserInfoResp | null>(null);
  const [hasClaimedNFT, setHasClaimedNFT] = useState(false);
  // isClaiming lets us easily keep a loading state while the NFT is minting.
  const [isClaiming, setIsClaiming] = useState(false);

  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  const [searchInput, setSearchInput] = useState<string>("");
  const [followLoading, setFollowLoading] = useState<boolean>(false);
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [snackbarText, setSnackbarText] = useState<string>("");
  const [followListInfo, setFollowListInfo] =
    useState<FollowListInfoResp | null>(null);

  const fetchSearchAddrInfo = async () => {
    const resp = await searchUserInfoQuery({
      fromAddr: address,
      toAddr: SEARCHADDRESS,
      namespace: NAME_SPACE,
      network: NETWORK,
    });
    console.log("resp:", resp);
    if (resp) {
      setSearchAddrInfo(resp);
      console.log("searchAddrInfo:", searchAddrInfo);
    }
  };

  const handleFollow = async () => {
    if (!cyberConnect || !searchAddrInfo) {
      return;
    }

    setFollowLoading(true);

    // Execute connect if the current user is not following the search addrress.
    if (!searchAddrInfo.followStatus.isFollowing) {
      await cyberConnect.connect(searchInput);

      // Overwrite the local status of isFollowing
      setSearchAddrInfo((prev) => {
        return !!prev
          ? {
              ...prev,
              followStatus: {
                ...prev.followStatus,
                isFollowing: true,
              },
            }
          : prev;
      });

      // Add the new following to the current user followings list
      setFollowListInfo((prev) => {
        return !!prev
          ? {
              ...prev,
              followingCount: prev.followingCount + 1,
              followings: {
                ...prev.followings,
                list: removeDuplicate(
                  prev.followings.list.concat([searchAddrInfo.identity])
                ),
              },
            }
          : prev;
      });

      setSnackbarText("Follow Success!");
    } else {
      await cyberConnect.disconnect(searchInput);

      setSearchAddrInfo((prev) => {
        return !!prev
          ? {
              ...prev,
              followStatus: {
                ...prev.followStatus,
                isFollowing: false,
              },
            }
          : prev;
      });

      setFollowListInfo((prev) => {
        return !!prev
          ? {
              ...prev,
              followingCount: prev.followingCount - 1,
              followings: {
                ...prev.followings,
                list: prev.followings.list.filter((user) => {
                  return user.address !== searchAddrInfo.identity.address;
                }),
              },
            }
          : prev;
      });

      setSnackbarText("Unfollow Success!");
    }

    setSnackbarOpen(true);
    setFollowLoading(false);
  };

  // The signer is required to sign transactions on the blockchain.
  // Without it we can only read data, not write.
  const signer = provider ? provider.getSigner() : undefined;

  // State variable for us to know if user has our NFT.

  // Another useEffect!
  useEffect(() => {
    if (signer && sdk) {
      sdk.setProviderOrSigner(signer);
    }
    // We pass the signer to the sdk, which enables us to interact with
    // our deployed contract!
  }, [signer, sdk]);

  useEffect(() => {
    // If they don't have an connected wallet, exit!
    if (!address || !bundleDrop) {
      return;
    }

    // Check if the user has the NFT by using bundleDropModule.balanceOf
    bundleDrop
      .balanceOf(address, "0")
      .then((balance) => {
        // If balance is greater than 0, they have our NFT!
        if (balance.gt(0)) {
          setHasClaimedNFT(true);
          console.log("🌟 this user has a membership NFT!");
        } else {
          setHasClaimedNFT(false);
          console.log("😭 this user doesn't have a membership NFT.");
        }
      })
      .catch((error) => {
        setHasClaimedNFT(false);
        console.error("failed to nft balance", error);
      });
  }, [address, bundleDrop]);

  // Add this little piece!
  if (hasClaimedNFT) {
    return (
      <div className="member-page">
        <h2>Fan Member Page</h2>
        <p>Congratulations on being a member</p>
      </div>
    );
  }

  const mintNft = () => {
    setIsClaiming(true);
    if (!bundleDrop) {
      return;
    }
    console.log(bundleDrop);
    // Call bundleDropModule.claim("0", 1) to mint nft to user's wallet.
    bundleDrop
      .claim("0", 1)
      .then(() => {
        // Set claim state.
        setHasClaimedNFT(true);
        // Show user their fancy new NFT!
        console.log(
          `🌊 Successfully Minted! Check it our on OpenSea: https://testnets.opensea.io/assets/${bundleDrop.address.toLowerCase()}/0`
        );
      })
      .catch((err) => {
        alert("You don't have permission to mint this NFT.");
        console.error("failed to claim", err);
      })
      .finally(() => {
        // Stop loading state.
        setIsClaiming(false);
      });
  };

  const hanndleAddWhitelist = async () => {
    if (whitelist.indexOf(address) !== -1) {
      console.log("already in whitelist");
      return;
    } else {
      updateWhitelist(address, true);
      console.log("Add {address} to whitelist");
    }
  };

  const checkCanClaim = async () => {
    if (!bundleDrop) return;
    console.log("Check if you can claim");
    try {
      const result = await bundleDrop.canClaim("0", 1);

      console.log(result);
    } catch (e) {
      console.log(e);
    }
  };
  // Render mint nft screen.

  return (
    <div className="bg-black h-screen">
      <HeaderLink />;
      <div className="flex flex-col h-5/6 justify-center items-center">
        <div className="flex items-center justify-center">
          <div className="relative w-96 h-96 border-2 mr-14">
            <Image src="/6.png" layout="fill" objectFit="contain" />
          </div>
          <div>
            <div className="flex flex-row items-center">
              <h1 className="text-white text-5xl font-semibold m-4">
                cyberlab.eth
              </h1>
              <LoadingButton
                onClick={handleFollow}
                disabled={
                  searchLoading || !isValidAddr(searchInput) || !address
                }
                loading={followLoading}
                className="bg-white"
              >
                {!searchAddrInfo?.followStatus.isFollowing
                  ? "Follow"
                  : "Unfollow"}
              </LoadingButton>
            </div>

            <p className="text-white text-lg my-2 mx-4">
              Address: 0x148d59faf10b52063071eddf4aaf63a395f2d41c
            </p>
            <button
              onClick={checkCanClaim}
              className="bg-white w-60 m-4 rounded-md p-2 hover:bg-gray-600 hover:300"
            >
              Check if I am eligible to claim
            </button>
            {/* <button
              onClick={hanndleAddWhitelist}
              className="bg-gray-600 w-60 m-4 rounded-md p-2 hover:bg-gray-600 hover:300"
            >
              Add address to whitelist
            </button> */}
            <h1 className="text-white mx-4">
              Mint your free Membership NFT if you followed "cyberlab.eth"
            </h1>
            <button
              disabled={isClaiming}
              onClick={() => mintNft()}
              className="bg-white w-60 m-4 rounded-md p-2 hover:bg-gray-600 hover:300"
            >
              {isClaiming ? "Minting..." : "Mint your NFT (FREE)"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
