import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sosRouter from "./sos";
import authRouter from "./auth";
import adminRouter from "./admin";
import incidentsRouter from "./incidents";
import mlRouter from "./ml";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sosRouter);
router.use(authRouter);
router.use(adminRouter);
router.use(incidentsRouter);
router.use(mlRouter);

export default router;
