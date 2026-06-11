import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  CreateTicketSchema,
  UpdateTicketSchema,
  TicketFiltersSchema,
  ImportFormat,
} from '../types/ticket.types';
import { TicketRepository } from '../repositories/ticket.repository';
import { TicketService } from '../services/ticket.service';
import { ImportService } from '../services/import.service';
import { ClassificationService } from '../services/classification.service';
import { ValidationError, AppError, UnsupportedMediaError } from '../utils/errors';

const repo = new TicketRepository();
const classifier = new ClassificationService();
const ticketService = new TicketService(repo, classifier);
const importService = new ImportService(ticketService);

export class TicketController {
  private ticketService = ticketService;
  private importService = importService;

  createTicket = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const dto = CreateTicketSchema.parse(req.body);
      const autoClassify = req.query.auto_classify === 'true';

      const ticket = this.ticketService.create(dto, autoClassify);
      res.status(201).json(ticket);
    } catch (error) {
      next(this.handleValidationError(error));
    }
  };

  listTickets = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const filters = TicketFiltersSchema.parse(req.query);
      const tickets = this.ticketService.getAll(filters);
      res.json(tickets);
    } catch (error) {
      next(this.handleValidationError(error));
    }
  };

  getTicket = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { id } = req.params;
      const ticket = this.ticketService.getById(id);
      res.json(ticket);
    } catch (error) {
      next(error);
    }
  };

  updateTicket = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { id } = req.params;
      const dto = UpdateTicketSchema.parse(req.body);

      const ticket = this.ticketService.update(id, dto);
      res.json(ticket);
    } catch (error) {
      next(this.handleValidationError(error));
    }
  };

  deleteTicket = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { id } = req.params;
      this.ticketService.delete(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  importTickets = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.file) {
        throw new ValidationError('No file provided', [
          { field: 'file', message: 'File is required' },
        ]);
      }

      const mimeToFormat: Record<string, ImportFormat> = {
        'text/csv': 'csv',
        'application/json': 'json',
        'text/xml': 'xml',
        'application/xml': 'xml',
      };

      let format: ImportFormat | undefined = mimeToFormat[req.file.mimetype];

      if (!format) {
        const ext = req.file.originalname.split('.').pop()?.toLowerCase();
        if (ext === 'csv') format = 'csv';
        else if (ext === 'json') format = 'json';
        else if (ext === 'xml') format = 'xml';
      }

      if (!format) {
        throw new UnsupportedMediaError(req.file.mimetype);
      }

      const result = await this.importService.importFromBuffer(
        req.file.buffer,
        format
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  autoClassify = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { id } = req.params;
      const result = this.ticketService.autoClassify(id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  private handleValidationError(error: unknown): AppError {
    if (error instanceof z.ZodError) {
      const details = error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      return new ValidationError('Request validation failed', details);
    }

    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof Error) {
      return new AppError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
    }

    return new AppError('INTERNAL_ERROR', 'An unknown error occurred', 500);
  }
}
