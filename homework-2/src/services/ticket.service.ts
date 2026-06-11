import { v4 as uuidv4 } from 'uuid';
import { TicketRepository } from '../repositories/ticket.repository';
import {
  Ticket,
  CreateTicketDTO,
  UpdateTicketDTO,
  InternalUpdatePatch,
  ClassificationResult,
  TicketFilters,
} from '../types/ticket.types';
import { ClassificationService } from './classification.service';
import { NotFoundError } from '../utils/errors';

export class TicketService {
  constructor(
    private repository: TicketRepository,
    private classifier: ClassificationService
  ) {}

  create(dto: CreateTicketDTO, autoClassify: boolean = false): Ticket {
    const now = new Date().toISOString();
    const ticket: Ticket = {
      id: uuidv4(),
      customer_id: dto.customer_id || null,
      customer_email: dto.customer_email,
      customer_name: dto.customer_name || null,
      subject: dto.subject,
      description: dto.description,
      category: dto.category || null,
      priority: dto.priority,
      status: dto.status,
      created_at: now,
      updated_at: now,
      resolved_at: null,
      assigned_to: dto.assigned_to || null,
      tags: dto.tags,
      metadata: dto.metadata,
      classification_confidence: null,
    };

    if (autoClassify) {
      const result = this.classifier.classify(
        ticket.subject,
        ticket.description
      );
      ticket.category = result.category;
      ticket.priority = result.priority;
      ticket.classification_confidence = result.confidence;
    }

    return this.repository.insert(ticket);
  }

  getById(id: string): Ticket {
    const ticket = this.repository.findById(id);
    if (!ticket) {
      throw new NotFoundError('Ticket', id);
    }
    return ticket;
  }

  getAll(filters?: TicketFilters): Ticket[] {
    return this.repository.findAll(filters);
  }

  update(id: string, dto: UpdateTicketDTO): Ticket {
    const ticket = this.getById(id);

    const patch: InternalUpdatePatch =
      dto.status === 'resolved' && ticket.status !== 'resolved'
        ? { ...dto, resolved_at: new Date().toISOString() }
        : dto;

    return this.repository.update(id, patch);
  }

  delete(id: string): void {
    this.getById(id);
    this.repository.delete(id);
  }

  autoClassify(id: string): ClassificationResult {
    const ticket = this.getById(id);
    const raw = this.classifier.classify(
      ticket.subject,
      ticket.description
    );
    const result: ClassificationResult = { ...raw, ticket_id: id };

    this.repository.updateClassification(id, result);

    return result;
  }
}
