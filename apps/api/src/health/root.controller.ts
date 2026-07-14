import { Controller, Get, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { Public } from "../auth/public.decorator";

@Controller()
export class RootController {
  @Public()
  @Get()
  root(@Req() req: Request, @Res() res: Response) {
    const webApp = process.env.WEB_APP_URL ?? "http://localhost:3000";
    const acceptsHtml = (req.headers.accept ?? "").includes("text/html");

    if (acceptsHtml) {
      return res.redirect(302, webApp);
    }

    return res.json({
      service: "ekulmis-api",
      status: "ok",
      message: "API is running. Open the school ERP in your browser.",
      webApp,
      endpoints: {
        health: "/health",
        api: "/api",
      },
    });
  }
}
