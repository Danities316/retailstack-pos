"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const password_service_1 = require("../services/password.service");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: '.env' });
const prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Starting the seed process...');
        const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
        const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;
        const superAdminPhoneNumber = process.env.SUPER_ADMIN_PHONE_NUMBER;
        if (!superAdminEmail || !superAdminPassword || !superAdminPhoneNumber) {
            throw new Error('SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, and SUPER_ADMIN_PHONE_NUMBER must be set in your .env file');
        }
        const hashedPassword = yield (0, password_service_1.hashPassword)(superAdminPassword);
        // Using `upsert` to prevent creating a duplicate admin on subsequent seeds.
        const superAdmin = yield prisma.user.upsert({
            where: { email: superAdminEmail },
            update: {}, // We don't want to update anything if the admin already exists
            create: {
                email: superAdminEmail,
                password: hashedPassword,
                phoneNumber: superAdminPhoneNumber,
                name: 'Super Admin',
                role: client_1.UserRole.SUPER_ADMIN,
                tenant: { create: { name: 'Super Admin', phoneNumber: "2091827661" } },
                // Note: tenantId is omitted, so it will be null
            },
        });
        console.log(`Super Admin user ensured: ${superAdmin.email}`);
    });
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => __awaiter(void 0, void 0, void 0, function* () {
    yield prisma.$disconnect();
}));
