import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import devicesRouter from "./devices";
import mdmPackagesRouter from "./mdm-packages";
import jobsRouter from "./jobs";
import usersRouter from "./users";
import statsRouter from "./stats";
import agentRouter from "./agent";
import deviceOpsRouter from "./device-operations";
import tokensRouter from "./tokens";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(devicesRouter);
router.use(deviceOpsRouter);
router.use(mdmPackagesRouter);
router.use(jobsRouter);
router.use(usersRouter);
router.use(statsRouter);
router.use(agentRouter);
router.use(tokensRouter);

export default router;
