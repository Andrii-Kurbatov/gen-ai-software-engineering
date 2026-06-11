import { Router } from 'express';
import multer from 'multer';
import { TicketController } from '../controllers/tickets.controller';
import { UnsupportedMediaError } from '../utils/errors';

const router = Router();
const controller = new TicketController();

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['text/csv', 'application/json', 'text/xml', 'application/xml', 'application/octet-stream'];
    const filename = file.originalname.toLowerCase();
    const isValidMime = allowedMimes.includes(file.mimetype);
    const isValidExt = filename.endsWith('.csv') || filename.endsWith('.json') || filename.endsWith('.xml');

    if (isValidMime || isValidExt) {
      cb(null, true);
    } else {
      cb(new UnsupportedMediaError(file.mimetype));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

router.post('/', controller.createTicket);
router.get('/', controller.listTickets);
router.get('/:id', controller.getTicket);
router.put('/:id', controller.updateTicket);
router.delete('/:id', controller.deleteTicket);
router.post('/import', upload.single('file'), controller.importTickets);
router.post('/:id/auto-classify', controller.autoClassify);

export default router;
