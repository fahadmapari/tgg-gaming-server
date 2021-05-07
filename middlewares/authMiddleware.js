import User from "../models/userModel.js";
import jwt from "jsonwebtoken";
import Session from "../models/sessionModel.js";

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
  let token = req.cookies.access_token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.TOKEN_SECRET);

      const session = await Session.findOne({
        token: token,
        user: decoded.userId,
      })
        .populate("user")
        .exec();

      if (!session) {
        return res.status(401).json({
          status: "Unauthorized",
          message: "User not logged in.",
        });
      }

      const user = session.user;

      user = {
        id: user._id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        mobile: user.mobile,
        mobileVerified: user.mobileVerified,
        role: user.role,
        coins: user.coins,
      };

      if (!user.emailVerified && user.mobileVerified) {
        return res.status(401).json({
          status: "Error",
          message: "email or mobile not verified",
        });
      }

      req.user = user;
      req.token = token;

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

export const validateNewUserToken = async (req, res, next) => {
  let token = req.cookies.access_token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.TOKEN_SECRET);

      const session = await Session.findOne({
        token: token,
        user: decoded.userId,
      })
        .populate("user")
        .exec();

      if (!session) {
        return res.status(401).json({
          status: "Unauthorized",
          message: "User not logged in.",
        });
      }

      const user = session.user;

      user = {
        id: user._id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        mobile: user.mobile,
        mobileVerified: user.mobileVerified,
        role: user.role,
        coins: user.coins,
      };

      req.user = user;
      req.token = token;

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

export const validateAdminToken = async (req, res, next) => {
  let token = req.cookies.access_token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.TOKEN_SECRET);
      let session = await Session.findOne({
        token: token,
        user: decoded.userId,
      })
        .populate("user")
        .exec();

      if (!session) {
        return res.status(401).json({
          status: "Unauthorized",
          message: "User not logged in.",
        });
      }

      const user = session.user;

      user = {
        id: user._id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        mobile: user.mobile,
        mobileVerified: user.mobileVerified,
        role: user.role,
        coins: user.coins,
      };

      req.user = user;
      req.token = token;

      if (user.role !== "admin") {
        return res.status(401).json({
          status: "Unauthorized",
          message: "User not authorized to perform this task.",
        });
      }

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
