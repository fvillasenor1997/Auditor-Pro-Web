import { Router, type IRouter } from "express";
import healthRouter from "./health";
import inventoriesRouter from "./inventories";

const router: IRouter = Router();

router.use(healthRouter);
router.use(inventoriesRouter);

export default router;
