import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { FinanceService } from "./finance.service";

@Injectable()
export class OverdueCron {
  private readonly logger = new Logger(OverdueCron.name);

  private isRunning = false;
  private lastRunAt: number | null = null;

  constructor(private readonly finance: FinanceService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleOverdueCharges() {
    const now = Date.now();

    //  proteção contra travamento eterno
    if (this.isRunning) {
      if (this.lastRunAt && now - this.lastRunAt > 10 * 60 * 1000) {
        this.logger.warn(" Resetando lock travado...");
        this.isRunning = false;
      } else {
        this.logger.warn(" Cron já em execução, pulando...");
        return;
      }
    }

    this.isRunning = true;
    this.lastRunAt = now;

    this.logger.log(" Verificando cobranças vencidas...");

    try {
      const orgIds = await this.finance.getAllOrgIds();

      const chunkSize = 5;

      for (let i = 0; i < orgIds.length; i += chunkSize) {
        const chunk = orgIds.slice(i, i + chunkSize);

        await Promise.all(
          chunk.map(async (orgId) => {
            try {
              await this.finance.automateOverdueLifecycle(orgId);
            } catch (err) {
              this.logger.error(
                ` Erro ao processar org ${orgId}`,
                err
              );
            }
          })
        );
      }

      this.logger.log(" Verificação concluída");
    } catch (error) {
      this.logger.error(
        " Erro geral no cron de cobranças vencidas",
        error
      );
    } finally {
      this.isRunning = false;
    }
  }
}
