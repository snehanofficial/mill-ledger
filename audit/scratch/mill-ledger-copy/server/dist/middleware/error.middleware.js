import { ZodError } from "zod";
import { env } from "../config/env.js";
export class AppError extends Error {
    statusCode;
    isOperational;
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
export function errorHandler(err, _req, res, _next) {
    if (err instanceof ZodError) {
        res.status(400).json({
            error: "Validation Error",
            details: err.flatten(),
        });
        return;
    }
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            error: err.message,
        });
        return;
    }
    const errObj = err;
    if (errObj.code === "P2004" ||
        errObj.code === "23514" ||
        (typeof err.message === "string" &&
            (err.message.includes("chk_current_stock_non_negative") ||
                err.message.includes("23514")))) {
        res.status(409).json({
            error: "Insufficient stock: cannot reduce stock balance below zero",
        });
        return;
    }
    if (errObj.code === "P2002") {
        res.status(409).json({
            error: "Conflict: unique constraint violation",
        });
        return;
    }
    // Unhandled internal errors
    console.error("Unhandled Server Error:", err);
    res.status(500).json({
        error: "Internal Server Error",
        ...(env.NODE_ENV !== "production"
            ? { message: err.message, stack: err.stack }
            : {}),
    });
}
