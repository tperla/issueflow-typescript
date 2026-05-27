import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Ticket } from './ticket.entity';

@Entity('ticket_dependencies')
export class TicketDependency {
  @PrimaryColumn()
  ticketId: number;

  @PrimaryColumn()
  blockedById: number;

  @ManyToOne(() => Ticket)
  @JoinColumn({ name: 'ticketId' })
  ticket: Ticket;

  @ManyToOne(() => Ticket)
  @JoinColumn({ name: 'blockedById' })
  blockedBy: Ticket;
}
