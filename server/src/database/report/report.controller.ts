import { Controller, Get, Post, Body, Delete, Patch, Query, UseGuards, Res } from '@nestjs/common';
import { ReportService } from './report.service';
import { AnyARecord } from 'dns';
import { JwtAuthGuard } from 'src/auth/Auth.guard';
import { Response } from 'express';
import { StreamableFile } from '@nestjs/common';
import { Readable } from 'stream';
import * as fs from 'fs/promises';

@Controller('report')
@UseGuards(JwtAuthGuard)
export class ReportController {
    jwtService: any;
    constructor(private readonly reportService: ReportService) { }

    @Post('monthly')
    async generateMonthlyReport(@Body('clientId') clientId: string, @Res() res: Response) {
        try {
            const buffer = await this.reportService.generateMonthlyReport(clientId);

            res
                .set({
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': 'attachment; filename=monthly_report.pdf',
                    'Content-Length': buffer.length,
                })
                .status(200)
                .send(buffer);
        } catch (error) {
            console.error('Ошибка генерации отчёта:', error);
            res.status(500).json({ message: 'Ошибка генерации отчёта' });
        }
    }



}   
