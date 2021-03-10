import User from "../models/userModel.js";
import jwt from "jsonwebtoken";

export const checkGuest = (req, res, next) => {
  const token = req.cookies.access_token;

  if (!token) {
    next();
  } else {
    return res.status(403).json({
      status: "Error",
      message: "Already logged in.",
    });
  }
};

export const validateToken = async (req, res, next) => {
  const token = req.cookies.access_token;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.TOKEN_SECRET);
      let user = await User.findOne({ _id: decoded.userId });

      user = {
        name: user.name,
        email: user.email,
        role: user.role,
        coins: user.coins,
      };

      req.user = user;

      return next();
    } catch (err) {
      return res.status(403).json({
        status: "Error",
        error: err.message,
        message: "Something went wrong while validating token. Invalid token",
      });
    }
  } else {
    return res.status(403).json({
      status: "Error",
      message: "User not logged in.",
    });
  }
};
