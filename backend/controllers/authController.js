import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "../utils/security.js";
import { User } from "../models/User.js";
import { authLoginSchema, authSignupSchema, validate } from "../utils/validation.js";

const signToken = (user) => {
  const secret = getJwtSecret();
  return jwt.sign({ userId: user._id.toString(), email: user.email }, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

const safeUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  preferences: user.preferences || {},
});

export const authController = {
  async signup(req, res) {
    const parsed = validate(authSignupSchema, req.body || {});
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const { name, email, password } = parsed.data;

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: "An account with this email already exists" });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash });

    res.status(201).json({ user: safeUser(user), token: signToken(user) });
  },

  async login(req, res) {
    const parsed = validate(authLoginSchema, req.body || {});
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const { email, password } = parsed.data;

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid email or password" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid email or password" });

    res.json({ user: safeUser(user), token: signToken(user) });
  },

  async me(req, res) {
    res.json({ user: safeUser(req.user) });
  },
};
