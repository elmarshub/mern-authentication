import { Resend } from "resend";
import config from "../config/app.config.js";

const resend = new Resend(config.MAILER.RESEND_API_KEY);

export default resend;
