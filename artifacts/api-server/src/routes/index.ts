import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sosRouter from "./sos";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sosRouter);

export default router;
