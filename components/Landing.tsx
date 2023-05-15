import React, { useCallback, useEffect, useMemo, useState } from "react";
import styles from "@/styles/Landing.module.css";
import { ApiPromise, WsProvider, ApiRx } from "@polkadot/api";
import { formatBalance } from "@polkadot/util";
import { web3Enable, web3FromAddress } from "@polkadot/extension-dapp";
import { toast } from "react-toastify";
const { pairwise, startWith } = require("rxjs/operators");

const Landing = () => {
  const [senderAddress, setSenderAddress] = useState("");
  const [receiverAddress, setReceiverAddress] = useState("");
  const [amount, setAmount] = useState("0");
  const [balance, setBalance] = useState("");

  const [button, setButton] = useState({
    isLoading: false,
    text: "Make Transfer",
    loadingText: "Making Transfer . . . .",
  });

  const wsProvider = useMemo(
    () => new WsProvider("wss://blockchain.polkadex.trade"),
    []
  );

  const getBalance = useCallback(
    async (senderAddr: string) => {
      console.log(senderAddr);
      if (senderAddr?.trim().length === 0) return;

      // Create an await for the API
      const api = await ApiRx.create({ provider: wsProvider }).toPromise();

      // Here we subscribe to any balance changes and update the on-screen value.
      // We're using RxJs pairwise() operator to get the previous and current values as an array.
      api.query.system
        .account(senderAddr)
        .pipe(
          // since pairwise only starts emitting values on the second emission, we prepend an
          // initial value with the startWith() operator to be able to also receive the first value
          startWith("first"),
          pairwise()
        )
        .subscribe((balance: any) => {
          if (balance[0] === "first") {
            // Now we know that if the previous value emitted as balance[0] is `first`,
            // then balance[1] is the initial value of Alice account.
            const chainDecimals = api.registry.chainDecimals[0];
            formatBalance.setDefaults({ unit: "DOT" });
            const free = formatBalance(
              balance[1].data.free,
              { withSiFull: true },
              chainDecimals
            );
            setBalance(free);
            console.log(`${senderAddr} has a balance of ${free}`);
            console.log(
              'You may leave this example running and start the "Make a transfer" example or transfer any value to Alice address'
            );
            return;
          }
        });
    },
    [wsProvider]
  );

  useEffect(() => {
    getBalance(senderAddress);
  }, [senderAddress, getBalance]);

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
              getBalance(senderAddress);
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
