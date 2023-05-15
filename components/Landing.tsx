import React, { useCallback, useEffect, useMemo, useState } from "react";
import styles from "@/styles/Landing.module.css";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { formatBalance } from "@polkadot/util";
import { web3Enable, web3FromAddress } from "@polkadot/extension-dapp";
import { toast } from "react-toastify";
import useSwr from "swr";

const Landing = () => {
  const [senderAddress, setSenderAddress] = useState("");
  const [receiverAddress, setReceiverAddress] = useState("");
  const [amount, setAmount] = useState("0");

  const [button, setButton] = useState({
    isLoading: false,
    text: "Make Transfer",
    loadingText: "Making Transfer . . . .",
  });

  const wsProvider = useMemo(
    () => new WsProvider("wss://blockchain.polkadex.trade"),
    []
  );

  const getBalance = async (senderAddr: string) => {
    console.log(senderAddr);
    if (senderAddr?.trim().length === 0) return;
    const api = await ApiPromise.create({ provider: wsProvider });

    // Retrieve the last timestamp
    const now = await api.query.timestamp.now();

    // Retrieve the account balance & nonce via the system module
    const { nonce, data: balance } = await api.query.system.account(senderAddr);

    const chainDecimals = api.registry.chainDecimals[0];

    formatBalance.setDefaults({ unit: "DOT" });
    const free = formatBalance(
      balance.free,
      { withSiFull: true },
      chainDecimals
    );

    console.log(`${now}: balance of ${free} and a nonce of ${nonce}`);
    return free;
  };

  const { data: balance } = useSwr(
    "fetch-balance",
    ({ sendAddr = senderAddress }: { sendAddr: string }) => getBalance(sendAddr)
  );

  const makeTransfer = async () => {
    try {
      setButton((prev) => ({
        ...prev,
        isLoading: true,
      }));
      const api = await ApiPromise.create({ provider: wsProvider });
      const extensions = await web3Enable("PolkaDot.JS Extension");
      if (extensions.length === 0) {
        toast.info("No extesion found");
        return;
      }

      const injector = await web3FromAddress(senderAddress);
      const chainDecimals = api.registry.chainDecimals[0];

      await api.tx.balances
        .transfer(receiverAddress, Number(amount) * Math.pow(10, chainDecimals))
        .signAndSend(
          senderAddress,
          { signer: injector.signer },
          ({ status }) => {
            if (status.isInBlock) {
              console.log(
                `Completed at block hash #${status.asInBlock.toString()}`
              );
              getBalance();
              toast.info("Transaction completed. Updating Balance....");
              setButton((prev) => ({
                ...prev,
                isLoading: false,
              }));
            } else {
              console.log(`Current status: ${status.type}`);
            }
          }
        )
        .catch((error: any) => {
          console.log(":( transaction failed", error);
          toast.error(error.message);
        });
    } catch (err: any) {
      console.log(err.message);
      toast.error(err.message);
      setButton((prev) => ({
        ...prev,
        isLoading: false,
      }));
    }
  };

  return (
    <>
      <div>
        <h1>PoC for making Transaction with Polkadot.JS</h1>
        <div className={styles.balances}>
          <h2>Available Balance - </h2>
          <span>{balance?.toString()}</span>
        </div>
        <label>Sender Address</label>
        <input
          placeholder="Sender Address"
          type="text"
          value={senderAddress}
          onChange={(e) => setSenderAddress(e.target.value)}
        />
        <label>Receiver Address</label>
        <input
          placeholder="Receiver Address"
          type="text"
          value={receiverAddress}
          onChange={(e) => setReceiverAddress(e.target.value)}
        />
        <label>Amount</label>
        <input
          placeholder="Amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <div className={styles.button}>
        <button onClick={makeTransfer} disabled={button.isLoading}>
          {button.isLoading ? button.loadingText : button.text}
        </button>
      </div>
    </>
  );
};

export default Landing;
