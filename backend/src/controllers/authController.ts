import { Request, Response } from "express";

export const getMe = async (req: Request, res: Response) => {
  res.json({
    user: (req as any).user,
  });
};