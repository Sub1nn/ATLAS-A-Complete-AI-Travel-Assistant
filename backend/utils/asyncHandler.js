import mongoose from "mongoose";

export const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export const validateObjectIdParam = (paramName = "id") => (req, res, next) => {
  const value = req.params?.[paramName];
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return res.status(400).json({ message: "Invalid identifier" });
  }
  return next();
};

export const validateObjectIdBody = (fieldName = "id") => (req, res, next) => {
  const value = req.body?.[fieldName];
  if (!value || !mongoose.Types.ObjectId.isValid(value)) {
    return res.status(400).json({ message: "Invalid identifier" });
  }
  return next();
};
