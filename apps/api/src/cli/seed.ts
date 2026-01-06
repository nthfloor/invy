import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { parseArgs } from 'util';

// Load .env from monorepo root
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

// Import entities
import { CompanyEntity } from '../company/company.entity';
import { ClientEntity } from '../client/client.entity';
import { ProductEntity } from '../product/product.entity';
import { InvoiceEntity, InvoiceItemEntity } from '../invoice/invoice.entity';
import { PaymentEntity, PaymentAllocationEntity } from '../payment/payment.entity';
import { TaxEntity } from '../tax/tax.entity';
import { DEFAULT_CURRENCY } from '../shared/constants/currencies';

// Parse CLI arguments
const { values } = parseArgs({
  options: {
    count: { type: 'string', short: 'c' },
    clients: { type: 'string' },
    products: { type: 'string' },
    invoices: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
});

if (values.help) {
  console.log(`
Usage: pnpm seed [options]

Options:
  -c, --count <n>     Set default count for all record types (default: 10)
  --clients <n>       Number of clients to create
  --products <n>      Number of products to create
  --invoices <n>      Number of invoices to create
  -h, --help          Show this help message

Examples:
  pnpm seed --count=50           # 50 of each type
  pnpm seed --clients=100 --products=30 --invoices=200
  pnpm seed -c 25                # 25 of each type
`);
  process.exit(0);
}

const defaultCount = parseInt(values.count || '10', 10);
const clientCount = parseInt(values.clients || String(defaultCount), 10);
const productCount = parseInt(values.products || String(defaultCount), 10);
const invoiceCount = parseInt(values.invoices || String(defaultCount), 10);

// Sample data for generating records
const firstNames = ['John', 'Sarah', 'Michael', 'Emma', 'James', 'Emily', 'David', 'Olivia', 'Daniel', 'Sophia', 'Matthew', 'Ava', 'Andrew', 'Isabella', 'Joshua', 'Mia', 'Christopher', 'Charlotte', 'Joseph', 'Amelia'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White'];
const companyNames = ['Solutions', 'Technologies', 'Consulting', 'Services', 'Group', 'Partners', 'Industries', 'Holdings', 'Enterprises', 'International'];
const productTypes = ['Consulting', 'Development', 'Support', 'Training', 'License', 'Maintenance', 'Integration', 'Analysis', 'Design', 'Implementation'];
const productModifiers = ['Basic', 'Standard', 'Premium', 'Enterprise', 'Professional', 'Advanced', 'Expert', 'Complete', 'Essential', 'Ultimate'];
const cities = ['Cape Town', 'Johannesburg', 'Durban', 'Pretoria', 'Port Elizabeth', 'Bloemfontein', 'Centurion', 'Sandton', 'Rosebank', 'Stellenbosch'];
const provinces = ['Western Cape', 'Gauteng', 'KwaZulu-Natal', 'Eastern Cape', 'Free State'];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateClientName(index: number): { name: string; email: string; isCompany: boolean } {
  const isCompany = index % 3 === 0;
  if (isCompany) {
    const name = `${randomElement(firstNames)} ${randomElement(companyNames)}`;
    return { name, email: `accounts@${name.toLowerCase().replace(/\s+/g, '')}.co.za`, isCompany: true };
  }
  const first = randomElement(firstNames);
  const last = randomElement(lastNames);
  return { name: `${first} ${last}`, email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`, isCompany: false };
}

function generateProductName(index: number): { name: string; description: string; price: number } {
  const type = randomElement(productTypes);
  const modifier = randomElement(productModifiers);
  const price = Math.floor(Math.random() * 20000) + 500;
  return {
    name: `${modifier} ${type}`,
    description: `${modifier} ${type.toLowerCase()} services package`,
    price,
  };
}

async function seed() {
  console.log('Connecting to database...');
  console.log(`\nConfiguration:`);
  console.log(`  Clients:  ${clientCount}`);
  console.log(`  Products: ${productCount}`);
  console.log(`  Invoices: ${invoiceCount}`);

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    entities: [
      CompanyEntity,
      ClientEntity,
      ProductEntity,
      InvoiceEntity,
      InvoiceItemEntity,
      PaymentEntity,
      PaymentAllocationEntity,
      TaxEntity,
    ],
    synchronize: false,
  });

  await dataSource.initialize();
  console.log('\nConnected to database');

  const companyRepo = dataSource.getRepository(CompanyEntity);
  const clientRepo = dataSource.getRepository(ClientEntity);
  const productRepo = dataSource.getRepository(ProductEntity);
  const invoiceRepo = dataSource.getRepository(InvoiceEntity);
  const invoiceItemRepo = dataSource.getRepository(InvoiceItemEntity);
  const paymentRepo = dataSource.getRepository(PaymentEntity);

  // Check if seed data already exists
  const existingCompany = await companyRepo.findOne({
    where: { name: 'Acme Corporation' },
  });

  if (existingCompany) {
    console.log('Seed data already exists. Skipping...');
    await dataSource.destroy();
    return;
  }

  console.log('\nSeeding demo data...');

  // ============================================
  // COMPANY: Acme Corporation
  // ============================================
  const acmeId = randomUUID();
  const acme = companyRepo.create({
    id: acmeId,
    name: 'Acme Corporation',
    email: 'accounts@acme.co.za',
    taxId: 'VAT123456789',
    currency: DEFAULT_CURRENCY,
    address: {
      line1: '123 Main Street',
      line2: 'Suite 100',
      city: 'Cape Town',
      state: 'Western Cape',
      postalCode: '8001',
      country: 'South Africa',
    },
    settings: {
      invoicePrefix: 'INV',
      quotePrefix: 'QT',
      paymentTermsDays: 30,
    },
    branding: {
      primaryColor: '#2563eb',
    },
    isActive: true,
  });
  await companyRepo.save(acme);
  console.log(`Created company: ${acme.name}`);

  // ============================================
  // CLIENTS
  // ============================================
  const clientIds: string[] = [];
  console.log(`Creating ${clientCount} clients...`);

  for (let i = 0; i < clientCount; i++) {
    const { name, email, isCompany } = generateClientName(i);
    const clientId = randomUUID();
    clientIds.push(clientId);

    const client = clientRepo.create({
      id: clientId,
      companyId: acmeId,
      name,
      email,
      phone: `+27 8${Math.floor(Math.random() * 10)} ${100 + Math.floor(Math.random() * 900)} ${1000 + Math.floor(Math.random() * 9000)}`,
      address: isCompany ? {
        line1: `${Math.floor(Math.random() * 200) + 1} ${randomElement(['Main', 'Oak', 'Church', 'Long', 'Market'])} Street`,
        city: randomElement(cities),
        state: randomElement(provinces),
        postalCode: String(Math.floor(Math.random() * 9000) + 1000),
        country: 'South Africa',
      } : undefined,
      isActive: Math.random() > 0.1, // 90% active
    });
    await clientRepo.save(client);

    if ((i + 1) % 20 === 0 || i === clientCount - 1) {
      console.log(`  Created ${i + 1}/${clientCount} clients`);
    }
  }

  // ============================================
  // PRODUCTS
  // ============================================
  const productIds: string[] = [];
  const productPrices: number[] = [];
  console.log(`Creating ${productCount} products...`);

  for (let i = 0; i < productCount; i++) {
    const { name, description, price } = generateProductName(i);
    const productId = randomUUID();
    productIds.push(productId);
    productPrices.push(price);

    const product = productRepo.create({
      id: productId,
      companyId: acmeId,
      name: `${name} ${i + 1}`,
      description,
      unitPrice: price,
      taxRate: 15,
      isActive: Math.random() > 0.05, // 95% active
    });
    await productRepo.save(product);

    if ((i + 1) % 20 === 0 || i === productCount - 1) {
      console.log(`  Created ${i + 1}/${productCount} products`);
    }
  }

  // ============================================
  // INVOICES
  // ============================================
  const invoiceIds: string[] = [];
  type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'partial' | 'cancelled';
  const invoiceStatuses: InvoiceStatus[] = ['draft', 'sent', 'paid', 'overdue', 'partial', 'cancelled'];
  const statusWeights = [0.1, 0.3, 0.35, 0.1, 0.1, 0.05]; // Weighted distribution

  console.log(`Creating ${invoiceCount} invoices...`);

  const today = new Date();
  let invoiceNum = 1;

  for (let i = 0; i < invoiceCount; i++) {
    const invoiceId = randomUUID();
    invoiceIds.push(invoiceId);

    // Select status based on weighted distribution
    const rand = Math.random();
    let cumulative = 0;
    let status: InvoiceStatus = 'sent';
    for (let j = 0; j < statusWeights.length; j++) {
      cumulative += statusWeights[j];
      if (rand < cumulative) {
        status = invoiceStatuses[j];
        break;
      }
    }

    // Random dates within last 90 days
    const daysAgo = Math.floor(Math.random() * 90);
    const issueDate = new Date(today.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const dueDate = new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Random number of items (1-5)
    const itemCount = Math.floor(Math.random() * 5) + 1;
    let subtotal = 0;

    // Calculate items first to get totals
    const items: Array<{ productId?: string; description: string; quantity: number; unitPrice: number; taxRate: number }> = [];
    for (let j = 0; j < itemCount; j++) {
      const useProduct = Math.random() > 0.2 && productIds.length > 0;
      const productIdx = Math.floor(Math.random() * productIds.length);
      const quantity = Math.floor(Math.random() * 10) + 1;
      const unitPrice = useProduct ? productPrices[productIdx] : Math.floor(Math.random() * 5000) + 100;

      items.push({
        productId: useProduct ? productIds[productIdx] : undefined,
        description: useProduct ? `Product ${productIdx + 1}` : `Custom service item ${j + 1}`,
        quantity,
        unitPrice,
        taxRate: 15,
      });

      subtotal += quantity * unitPrice;
    }

    const taxTotal = subtotal * 0.15;
    const total = subtotal + taxTotal;

    // Determine amount paid based on status
    let amountPaid = 0;
    if (status === 'paid') {
      amountPaid = total;
    } else if (status === 'partial') {
      amountPaid = Math.floor(total * (Math.random() * 0.5 + 0.25)); // 25-75% paid
    }

    const clientId = clientIds[Math.floor(Math.random() * clientIds.length)];

    const invoice = invoiceRepo.create({
      id: invoiceId,
      companyId: acmeId,
      clientId,
      invoiceNumber: `INV-${today.getFullYear()}-${String(invoiceNum++).padStart(4, '0')}`,
      status,
      issueDate,
      dueDate,
      subtotal,
      taxTotal,
      total,
      amountPaid,
      balance: total - amountPaid,
    });
    await invoiceRepo.save(invoice);

    // Save invoice items
    for (let j = 0; j < items.length; j++) {
      const item = items[j];
      const lineTotal = item.quantity * item.unitPrice;
      const lineTax = lineTotal * (item.taxRate / 100);

      const invoiceItem = invoiceItemRepo.create({
        id: randomUUID(),
        invoiceId,
        productId: item.productId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        lineTotal,
        lineTax,
        sortOrder: j,
      });
      await invoiceItemRepo.save(invoiceItem);
    }

    // Create payment if paid or partial
    if (amountPaid > 0) {
      const payment = paymentRepo.create({
        id: randomUUID(),
        companyId: acmeId,
        clientId,
        invoiceId,
        paymentNumber: `PAY-${today.getFullYear()}-${String(invoiceNum).padStart(4, '0')}`,
        amount: amountPaid,
        paymentDate: new Date(dueDate.getTime() - Math.floor(Math.random() * 15) * 24 * 60 * 60 * 1000),
        paymentMethod: randomElement(['bank_transfer', 'cash', 'credit_card', 'debit_card', 'cheque'] as const),
        status: 'completed',
      });
      await paymentRepo.save(payment);
    }

    if ((i + 1) % 20 === 0 || i === invoiceCount - 1) {
      console.log(`  Created ${i + 1}/${invoiceCount} invoices`);
    }
  }

  // ============================================
  // Done
  // ============================================
  await dataSource.destroy();
  console.log('\n========================================');
  console.log('Seed completed successfully!');
  console.log('========================================');
  console.log(`\nDemo data created:`);
  console.log(`  - 1 Company (Acme Corporation)`);
  console.log(`  - ${clientCount} Clients`);
  console.log(`  - ${productCount} Products`);
  console.log(`  - ${invoiceCount} Invoices with items and payments`);
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
