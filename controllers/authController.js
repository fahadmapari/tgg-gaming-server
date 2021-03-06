import User from "../models/userModel.js";
import Session from "../models/sessionModel.js";
import twilio from "twilio";
import { AppError } from "../utils/AppError.js";
import { generateToken } from "../utils/generateToken.js";
import {
  changeNameForSocialLogin,
  validateEmail,
} from "../utils/validations.js";
import {
  getGoogleAccountFromCode,
  googleConfig,
  defaultScope,
  createConnection,
  getConnectionUrl,
  urlGoogle,
} from "../utils/googleAuth.js";
import { facebookLoginUrl } from "../utils/facebookAuth.js";
import OAuthClient from "disco-oauth";
import axios from "axios";
import Referral from "../models/referralModel.js";
import { hashPassword } from "../utils/hashPassword.js";

const client = twilio(process.env.TWLO_SID, process.env.TWLO_TOKEN);
const discordClient = new OAuthClient(
  process.env.DISCORD_ID,
  process.env.DISCORD_SECRET
);

discordClient
  .setScopes(["identify", "email"])
  .setRedirect("https://www.tssgaming.in/user/discord.html");

const discordClientMobile = new OAuthClient(
  process.env.DISCORD_ID,
  process.env.DISCORD_SECRET
);

discordClientMobile
  .setScopes(["identify", "email"])
  .setRedirect("https://www.tssgaming.in/api/auth/discord/mobile");

export const resetPasswordOTP = async (req, res, next) => {
  try {
    const { email } = req.params;

    if (!email || email === "")
      return next(new AppError("email is required.", 400));

    if (!validateEmail(email)) return next(new AppError("Invalid email", 400));

    const user = await User.findOne({ email: email });

    if (!user) return next(new AppError("user not found.", 400));

    client.verify
      .services(process.env.TWLO_SERVICE_ID)
      .verifications.create({ to: `${email}`, channel: "email" })
      .then((verification) => {
        res.status(200).json({
          message: "OTP SENT TO EMAIL",
          data: {
            to: verification.to,
            channel: verification.channel,
            status: verification.status,
            lookup: verification.lookup,
            dates: {
              created: verification.date_created,
              update: verification.date_updated,
            },
          },
        });
      })
      .catch((err) => {
        next(new AppError(err.message, 503));
      });
  } catch (err) {
    next(new AppError(err.message, 503));
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || email === "")
      return next(new AppError("email is required.", 400));

    if (!validateEmail(email)) return next(new AppError("Invalid email", 400));

    if (!otp || otp === "") return next(new AppError("otp is required.", 400));

    if (!newPassword || newPassword === "")
      return next(new AppError("new password is required.", 400));

    client.verify
      .services(process.env.TWLO_SERVICE_ID)
      .verificationChecks.create({ to: `${email}`, code: otp })
      .then(async (verification) => {
        if (verification.status === "approved") {
          const hashedPassword = await hashPassword(newPassword);

          await User.findOneAndUpdate(
            { email: email },
            { password: hashedPassword }
          );

          res.status(200).json({
            message: "password changed",
            to: verification.to,
            channel: verification.channel,
            status: verification.status,
            dates: {
              created: verification.date_created,
              update: verification.date_updated,
            },
          });
        } else {
          res.status(200).json({
            message: "invalid otp",
            to: verification.to,
            channel: verification.channel,
            status: verification.status,
            dates: {
              created: verification.date_created,
              update: verification.date_updated,
            },
          });
        }
      })
      .catch((err) => {
        next(new AppError("INVALID OTP", 503));
      });
  } catch (err) {
    next(new AppError(err.message, 503));
  }
};

export const generateOtp = async (req, res, next) => {
  try {
    const { id, mobile, email, mobileVerified, emailVerified } = req.user;
    const { method } = req.params;

    if (method !== "mobile" && method !== "email")
      return next(new AppError("Invalid verification method", 401));
    if (method === "mobile") {
      if (mobileVerified)
        return next(new AppError("Mobile already verified", 403));

      client.verify
        .services(process.env.TWLO_SERVICE_ID)
        .verifications.create({ to: `+91${mobile}`, channel: "sms" })
        .then((verification) => {
          res.status(200).json({
            message: "OTP SENT TO MOBILE",
            data: {
              to: verification.to,
              channel: verification.channel,
              status: verification.status,
              lookup: verification.lookup,
              dates: {
                created: verification.date_created,
                update: verification.date_updated,
              },
            },
          });
        })
        .catch((err) => {
          next(new AppError(err.message, 503));
        });
    }

    if (method === "email") {
      if (emailVerified)
        return next(new AppError("Email already verified", 403));

      client.verify
        .services(process.env.TWLO_SERVICE_ID)
        .verifications.create({ to: `${email}`, channel: "email" })
        .then((verification) => {
          res.status(200).json({
            message: "OTP SENT TO EMAIL",
            data: {
              to: verification.to,
              channel: verification.channel,
              status: verification.status,
              lookup: verification.lookup,
              dates: {
                created: verification.date_created,
                update: verification.date_updated,
              },
            },
          });
        })
        .catch((err) => {
          next(new AppError(err.message, 503));
        });
    }
  } catch (err) {
    next(new AppError(err.message, 503));
  }
};

export const verifyOtp = async (req, res, next) => {
  try {
    const { id, mobile, email, mobileVerified, emailVerified } = req.user;
    const { method } = req.params;
    const { otp } = req.body;

    if (method !== "mobile" && method !== "email")
      return next(new AppError("Invalid verification method", 401));

    if (!otp || otp === "") {
      return next(new AppError("OTP required", 401));
    }

    if (method === "mobile") {
      client.verify
        .services(process.env.TWLO_SERVICE_ID)
        .verificationChecks.create({ to: `+91${mobile}`, code: otp })
        .then(async (verification) => {
          if (verification.status === "approved") {
            await User.findOneAndUpdate(
              { _id: id },
              {
                mobileVerified: true,
              }
            );

            res.status(200).json({
              to: verification.to,
              channel: verification.channel,
              status: verification.status,
              dates: {
                created: verification.date_created,
                update: verification.date_updated,
              },
            });
          } else {
            res.status(200).json({
              to: verification.to,
              channel: verification.channel,
              status: verification.status,
              dates: {
                created: verification.date_created,
                update: verification.date_updated,
              },
            });
          }
        })
        .catch((err) => {
          next(new AppError("INVALID OTP", 503));
        });
    }

    //email otp verify
    if (method === "email") {
      client.verify
        .services(process.env.TWLO_SERVICE_ID)
        .verificationChecks.create({ to: `${email}`, code: otp })
        .then(async (verification) => {
          if (verification.status === "approved") {
            await User.findOneAndUpdate(
              { _id: id },
              {
                emailVerified: true,
              }
            );

            res.status(200).json({
              to: verification.to,
              channel: verification.channel,
              status: verification.status,
              dates: {
                created: verification.date_created,
                update: verification.date_updated,
              },
            });
          } else {
            res.status(200).json({
              to: verification.to,
              channel: verification.channel,
              status: verification.status,
              dates: {
                created: verification.date_created,
                update: verification.date_updated,
              },
            });
          }
        })
        .catch((err) => {
          next(new AppError("INVALID OTP", 503));
        });
    }
  } catch (err) {
    next(new AppError(err.message, 503));
  }
};

export const registerUser = async (req, res, next) => {
  let profilePic = process.env.DOMAIN_NAME + "/profile-pictures/default.png";
  let referredBy;
  if (req.file) {
    profilePic =
      process.env.DOMAIN_NAME + "/profile-pictures/" + req.file.filename;
  }

  if (!req.body.email || req.body.email === "")
    return next(new AppError("Email is required", 400));

  if (!req.body.mobile || req.body.mobile === "")
    return next(new AppError("Mobile number is required", 400));

  if (!validateEmail(req.body.email))
    return next(new AppError("Invalid email", 400));

  if (req.body.mobile.length < 10)
    return next(new AppError("Invalid mobile number", 400));

  if (!req.body.password || req.body.password === "")
    return next(new AppError("password is required", 400));

  if (!req.body.name || req.body.name === "")
    return next(new AppError("name is required", 400));

  const user = new User({
    email: req.body.email.toLowerCase(),
    mobile: req.body.mobile,
    password: req.body.password,
    name: req.body.name,
    profilePic: profilePic,
  });

  try {
    if (req.body.referCode) {
      try {
        referredBy = await User.findOneAndUpdate(
          { referralId: req.body.referCode },
          {
            $inc: { coins: Number(process.env.referAmount) },
          }
        );
      } catch (err) {
        return next(new AppError("Invalid Referral Code", 404));
      }
    }

    const newUser = await user.save();

    if (req.body.referCode) {
      await Referral.create({
        referredBy: referredBy._id,
        referredUser: newUser._id,
      });
    }

    const token = generateToken(newUser._id);
    let date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await Session.create({
      user: newUser._id,
      token,
      expireAt: date,
    });

    res
      .status(201)
      .cookie("access_token", token, {
        expires: date,
        httpOnly: true,
        sameSite: true,
      })
      .set({
        "api-key": token,
      })
      .json({
        userInfo: {
          name: newUser.name,
          mobile: newUser.mobile,
          mobileVerified: newUser.newUser,
          role: newUser.role,
          email: newUser.email,
          emailVerified: newUser.emailVerified,
          coins: newUser.coins,
          profilePic: newUser.profilePic,
          referralId: newUser.referralId,
        },
      });
  } catch (err) {
    next(new AppError(err.message, 503));
  }
};

export const loginUser = async (req, res, next) => {
  try {
    if (!req.body.email || req.body.email === "")
      return next(new AppError("email is required", 400));

    if (!req.body.password || req.body.password === "")
      return next(new AppError("password is required", 400));

    if (!validateEmail(req.body.email)) {
      return next(new AppError("Invalid email", 400));
    }

    const foundUser = await User.findOne({
      email: req.body.email.toLowerCase(),
    });

    if (!foundUser) return next(new AppError("User does not exist.", 404));

    const result = foundUser.checkPassword(
      req.body.password,
      foundUser.password
    );

    if (result) {
      const token = generateToken(foundUser._id);
      let date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await Session.create({
        user: foundUser._id,
        token,
        expireAt: date,
      });

      return res
        .cookie("access_token", token, {
          expires: date,
          httpOnly: true,
          sameSite: true,
        })
        .set({
          "api-key": token,
        })
        .json({
          userInfo: {
            name: foundUser.name,
            mobile: foundUser.mobile,
            mobileVerified: foundUser.mobileVerified,
            email: foundUser.email,
            emailVerified: foundUser.emailVerified,
            role: foundUser.role,
            coins: foundUser.coins,
            profilePic: foundUser.profilePic,
            referralId: foundUser.referralId,
          },
        });
    } else {
      return next(new AppError("Incorrect password.", 401));
    }
  } catch (err) {
    next(new AppError(err.message, 503));
  }
};

//google login/signup

export const generateGoogleURL = async (req, res, next) => {
  try {
    const url = urlGoogle();

    res.status(200).json({
      url: url,
    });
  } catch (err) {
    next(new AppError(err.message, 503));
  }
};

export const googleLogin = async (req, res, next) => {
  try {
    const data = await getGoogleAccountFromCode(req.query.code);
    const googleProfile = await axios.get(
      `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${data.data.tokens.access_token}`
    );
    const { email, name, picture } = googleProfile.data;

    const existingUser = await User.findOne({ email: email }).select(
      "-password"
    );

    if (existingUser) {
      const token = generateToken(existingUser._id);
      let date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await Session.create({
        user: existingUser._id,
        token,
        expireAt: date,
      });

      res
        .status(201)
        .cookie("access_token", token, {
          expires: date,
          httpOnly: true,
          sameSite: true,
        })
        .set({
          "api-key": token,
        })
        .json({
          userInfo: {
            ...existingUser._doc,
          },
        });
    }

    if (!existingUser) {
      const user = await User.create({
        name: changeNameForSocialLogin(name),
        email: email,
        emailVerified: true,
        password: "",
        profilePic: picture,
      });

      const token = generateToken(user._id);
      let date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await Session.create({
        user: user._id,
        token,
        expireAt: date,
      });

      res
        .status(200)
        .cookie("access_token", token, {
          expires: date,
          httpOnly: true,
          sameSite: true,
        })
        .set({
          "api-key": token,
        })
        .json({
          userInfo: {
            ...user._doc,
          },
        });
    }
  } catch (error) {
    next(new AppError(error.message, 503));
  }
};

export const googleLoginMobile = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) return next(new AppError("token is required.", 400));

    // const data = await getGoogleAccountFromCode(req.query.code);
    const googleProfile = await axios.get(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${token}`
    );

    const { email, name, picture } = googleProfile.data;

    const existingUser = await User.findOne({ email: email }).select(
      "-password"
    );

    if (existingUser) {
      const token = generateToken(existingUser._id);
      let date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await Session.create({
        user: existingUser._id,
        token,
        expireAt: date,
      });

      res
        .status(201)
        .cookie("access_token", token, {
          expires: date,
          httpOnly: true,
          sameSite: true,
        })
        .set({
          "api-key": token,
        })
        .json({
          userInfo: {
            name: existingUser.name,
            mobile: existingUser.mobile,
            mobileVerified: existingUser.mobileVerified,
            email: existingUser.email,
            emailVerified: existingUser.emailVerified,
            role: existingUser.role,
            coins: existingUser.coins,
            profilePic: existingUser.profilePic,
            referralId: existingUser.referralId,
          },
        });
    }

    if (!existingUser) {
      const user = await User.create({
        name: changeNameForSocialLogin(name),
        email: email,
        emailVerified: true,
        password: "",
        profilePic: picture,
      });

      const token = generateToken(user._id);
      let date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await Session.create({
        user: user._id,
        token,
        expireAt: date,
      });

      res
        .status(200)
        .cookie("access_token", token, {
          expires: date,
          httpOnly: true,
          sameSite: true,
        })
        .set({
          "api-key": token,
        })
        .json({
          userInfo: {
            name: user.name,
            mobile: user.mobile,
            mobileVerified: user.mobileVerified,
            email: user.email,
            emailVerified: user.emailVerified,
            role: user.role,
            coins: user.coins,
            profilePic: user.profilePic,
            referralId: user.referralId,
          },
        });
    }
  } catch (error) {
    next(new AppError(error.message, 503));
  }
};

// facebook auth

export const generateFacebookUrl = async (req, res, next) => {
  try {
    res.json({
      url: facebookLoginUrl,
    });
  } catch (err) {
    next(new AppError(err.message, 503));
  }
};

export const facebookLogin = async (req, res, next) => {
  try {
    const code = req.query.code;

    const { data } = await axios({
      url: "https://graph.facebook.com/v4.0/oauth/access_token",
      method: "get",
      params: {
        client_id: process.env.FACEBOOK_ID,
        client_secret: process.env.FACEBOOK_SECRET,
        redirect_uri: "https://tss-gaming.herokuapp.com/api/auth/facebook/",
        code,
      },
    });

    const { data: profile } = await axios({
      url: "https://graph.facebook.com/me",
      method: "get",
      params: {
        fields: [
          "id",
          "email",
          "first_name",
          "last_name",
          "name",
          "picture",
        ].join(","),
        access_token: data.access_token,
      },
    });

    const { email, name, picture } = profile;

    if (!email || email === "")
      return res.send({
        message: "Email is required. No email linked to this facebook account.",
      });

    const existingUser = await User.findOne({ email: email }).select(
      "-password"
    );

    if (existingUser) {
      const token = generateToken(existingUser._id);
      let date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await Session.create({
        user: existingUser._id,
        token,
        expireAt: date,
      });

      res
        .status(201)
        .cookie("access_token", token, {
          expires: date,
          httpOnly: true,
          sameSite: true,
        })
        .set({
          "api-key": token,
        })
        .json({
          userInfo: { ...existingUser._doc },
        });
    }

    if (!existingUser) {
      const user = await User.create({
        name: changeNameForSocialLogin(name),
        email: email,
        emailVerified: true,
        password: "",
        profilePic: picture.url,
      });

      const token = generateToken(user._id);
      let date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await Session.create({
        user: user._id,
        token,
        expireAt: date,
      });

      res
        .status(200)
        .cookie("access_token", token, {
          expires: date,
          httpOnly: true,
          sameSite: true,
        })
        .set({
          "api-key": token,
        })
        .json({
          userInfo: {
            ...user._doc,
          },
        });
    }
  } catch (err) {
    console.log(err);
    next(new AppError(err.message, 503));
  }
};

// discord auth

export const generateDiscordUrl = async (req, res, next) => {
  try {
    res.json({
      url: process.env.DISCORD_OAUTH_URL,
    });
  } catch (err) {
    next(new AppError(err.message, 503));
  }
};

export const generateDiscordMobileUrl = async (req, res, next) => {
  try {
    res.json({
      url: process.env.DISCORD_OAUTH_MOBILE_URL,
    });
  } catch (err) {
    next(new AppError(err.message, 503));
  }
};

export const discordLogin = async (req, res, next) => {
  try {
    const code = req.query.code;

    const access_token = await discordClient.getAccess(code);

    const user = await discordClient.getUser(access_token);

    const existingUser = await User.findOne({ email: user.emailId }).select(
      "-password"
    );

    if (existingUser) {
      const token = generateToken(existingUser._id);
      let date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await Session.create({
        user: existingUser._id,
        token,
        expireAt: date,
      });

      res
        .status(201)
        .cookie("access_token", token, {
          expires: date,
          httpOnly: true,
          sameSite: true,
        })
        .set({
          "api-key": token,
        })
        .json({
          userInfo: {
            ...existingUser._doc,
          },
        });
    }

    if (!existingUser) {
      const newUser = await User.create({
        name: changeNameForSocialLogin(user.username),
        email: user.emailId,
        emailVerified: true,
        password: "",
        profilePic: user.avatarUrl,
      });

      const token = generateToken(newUser._id);
      let date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await Session.create({
        user: newUser._id,
        token,
        expireAt: date,
      });

      res
        .status(200)
        .cookie("access_token", token, {
          expires: date,
          httpOnly: true,
          sameSite: true,
        })
        .set({
          "api-key": token,
        })
        .json({
          userInfo: { ...newUser._doc },
        });
    }
  } catch (err) {
    console.log(err);
    next(new AppError(err.message, 503));
  }
};

export const discordLoginMobile = async (req, res, next) => {
  try {
    const { code } = req.body;

    if (!code) return next(new AppError("code is required.", 400));

    const access_token = await discordClientMobile.getAccess(code);

    const user = await discordClientMobile.getUser(access_token);

    const existingUser = await User.findOne({ email: user.emailId }).select(
      "-password"
    );

    if (existingUser) {
      const token = generateToken(existingUser._id);
      let date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await Session.create({
        user: existingUser._id,
        token,
        expireAt: date,
      });

      res
        .status(201)
        .cookie("access_token", token, {
          expires: date,
          httpOnly: true,
          sameSite: true,
        })
        .set({
          "api-key": token,
        })
        .json({
          userInfo: {
            name: existingUser.name,
            mobile: existingUser.mobile,
            mobileVerified: existingUser.mobileVerified,
            email: existingUser.email,
            emailVerified: existingUser.emailVerified,
            role: existingUser.role,
            coins: existingUser.coins,
            profilePic: existingUser.profilePic,
            referralId: existingUser.referralId,
          },
        });
    }

    if (!existingUser) {
      const newUser = await User.create({
        name: changeNameForSocialLogin(user.username),
        email: user.emailId,
        emailVerified: true,
        password: "",
        profilePic: user.avatarUrl,
      });

      const token = generateToken(newUser._id);
      let date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await Session.create({
        user: newUser._id,
        token,
        expireAt: date,
      });

      res
        .status(200)
        .cookie("access_token", token, {
          expires: date,
          httpOnly: true,
          sameSite: true,
        })
        .set({
          "api-key": token,
        })
        .json({
          userInfo: {
            name: newUser.name,
            mobile: newUser.mobile,
            mobileVerified: newUser.mobileVerified,
            email: newUser.email,
            emailVerified: newUser.emailVerified,
            role: newUser.role,
            coins: newUser.coins,
            profilePic: newUser.profilePic,
            referralId: newUser.referralId,
          },
        });
    }
  } catch (err) {
    console.log(err);
    next(new AppError(err.message, 503));
  }
};

//log out
export const logoutUser = async (req, res, next) => {
  try {
    await Session.findOneAndDelete({ token: req.token });

    res
      .status(200)
      .cookie("access_token", {
        expires: Date.now(),
        httpOnly: true,
        sameSite: true,
      })
      .json({
        status: "logged out",
      });
  } catch (error) {
    next(new AppError(error.message, 503));
  }
};
