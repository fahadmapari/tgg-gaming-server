import Razorpay from "razorpay";
import crypto from "crypto";
import shortid from "shortid";
import Order from "../models/orderModel.js";
import User from "../models/userModel.js";
import Withdrawal from "../models/withdrawModel.js";
import { AppError } from "../utils/AppError.js";

const instance = new Razorpay({
  key_id: process.env.razor_id,
  key_secret: process.env.razor_secret,
});

export const buyCoins = async (req, res) => {
  const { coins } = req.body;
  try {
    const orderResponse = await instance.orders.create({
      amount: Number(coins) * 100,
      currency: "INR",
      receipt: shortid.generate(),
      payment_capture: true,
    });

    await Order.create({
      user: req.user._id,
      order_id: orderResponse.order_id,
      orderDetails: orderResponse,
    });

    res.json({
      orderResponse,
    });
  } catch (error) {
    next(new AppError(error.message, 503));
  }
};

export const verifyPayment = async (req, res) => {
  const shasum = crypto.createHmac("sha256", process.env.razor_secret);
  shasum.update(JSON.stringify(req.body));
  const digest = shasum.digest("hex");

  if (digest === req.headers["x-razorpay-signature"]) {
    if (
      req.body.payload.payment.entity.status === "captured" ||
      req.body.payload.payment.entity.status === "failed" ||
      req.body.payload.payment.entity.status === "authorized"
    ) {
      const updatedOrder = await Order.findOneAndUpdate(
        { order_id: req.body.payload.payment.entity.order_id },
        { orderDetails: req.body }
      );

      await User.findOneAndUpdate(
        { _id: updatedOrder.user },
        {
          $inc: { coins: Number(updatedOrderpayload.payment.amount) / 100 },
        }
      );
    }
  } else {
    await Order.findOneAndUpdate(
      { order_id: req.body.payload.payment.entity.order_id },
      { orderDetails: req.body }
    );
  }

  res.status(200).json({ status: "OK" });
};

export const withdrawRequestByUser = async (req, res, next) => {
  const { id: userId } = req.user;
  const { withdrawAmount } = req.body;

  try {
    if (withdrawAmount <= 0) {
      return next(new AppError("Withdrawal amount can not be empty.", 401));
    }

    if (Number(req.user.coins) - Number(withdrawAmount)) {
      return next(new AppError("Not enough coins.", 401));
    }

    const withdrawalData = await Withdrawal.create({
      user: userId,
      amount: withdrawAmount,
    });

    await User.findOneAndUpdate(
      { _id: userId },
      {
        $inc: {
          coins: -Math.abs(withdrawAmount),
        },
      }
    );

    res.status(201).json({
      data: withdrawalData,
    });
  } catch (error) {
    next(new AppError(error.message, 503));
  }
};

export const getPendingWithdrawalRequests = async (req, res, next) => {
  try {
    const withdrawals = await Withdrawal.find({ status: "pending" });

    res.status(200).json({
      withdrawals,
    });
  } catch (error) {
    next(new AppError(error.message, 503));
  }
};

export const getAllWithdrawalRequests = async (req, res, next) => {
  try {
    const withdrawals = await Withdrawal.find({});

    res.status(200).json({
      withdrawals,
    });
  } catch (error) {
    next(new AppError(error.message, 503));
  }
};

export const respondToWithdrawalRequests = async (req, res, next) => {
  const { id } = req.params;
  const { action } = req.body;
  let updatedRequest;
  try {
    if (action !== "accept" || action !== "decline")
      return next(new AppError("Invalid action", 400));

    if (action === "accept") {
      updatedRequest = await Withdrawal.findOneAndUpdate(
        { _id: id },
        {
          status: "accepted",
        }
      );
    }

    if (action === "decline") {
      updatedRequest = await Withdrawal.findOneAndUpdate(
        { _id: id },
        {
          status: "declined",
        }
      );

      //refund coins
      await User.findOneAndUpdate(
        { _id: updatedRequest.user },
        {
          $inc: {
            coins: Number(updatedRequest.amount),
          },
        }
      );
    }

    res.status(200).json({
      updatedRequest,
    });
  } catch (error) {
    next(new AppError(error.message, 503));
  }
};