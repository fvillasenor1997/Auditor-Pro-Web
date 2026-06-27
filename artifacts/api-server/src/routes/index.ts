import { Router, type IRouter } from "express";
import healthRouter from "./health";
import inventoriesRouter from "./inventories";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(inventoriesRouter);

export default router;
