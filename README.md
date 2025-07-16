# 🚌 TAPT Website (Tennessee Association of Pupil Transportation)

A modern, secure web application built with React, TypeScript, and Supabase, featuring Cloudflare Turnstile security integration.

## 🚀 Features

- **Modern React Architecture** - Built with React 18, TypeScript, and Vite
- **Security-First Design** - Cloudflare Turnstile integration on all forms
- **Multi-Domain Support** - Works on both tapt.org and tntapt.com
- **Admin Dashboard** - Complete administration interface
- **Forms & Registrations** - Conference, membership, nominations, scholarships
- **Document Generation** - PDF reports and certificates
- **Responsive Design** - Mobile-first with Tailwind CSS

## 🛠️ Tech Stack

### Frontend
- **React 18** - User interface library
- **TypeScript** - Type safety and better developer experience
- **Vite** - Fast build tool and development server
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Beautiful icon library
- **React Router** - Client-side routing

### Backend & Database
- **Supabase** - Backend-as-a-Service platform
- **PostgreSQL** - Relational database
- **Edge Functions** - Serverless API endpoints
- **Row Level Security** - Database-level access control

### Security
- **Cloudflare Turnstile** - Bot protection and CAPTCHA
- **CORS Protection** - Domain-restricted API access
- **Rate Limiting** - Prevents abuse and spam
- **Input Validation** - Server-side data validation

### Development Tools
- **ESLint** - Code linting and style enforcement
- **Prettier** - Code formatting
- **TypeScript** - Static type checking

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- npm 8+
- Supabase CLI (for deployment)

### Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd TAPT-V6
```

2. **Install dependencies**
```bash
npm install
```

3. **Environment Setup**
Create a `.env` file with the following variables:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_TURNSTILE_SITE_KEY=0x4AAAAAABkM5-7VsQWr1y7u
```

4. **Start development server**
```bash
npm run dev
```

5. **Build for production**
```bash
npm run build
```

## 🚀 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run type-check` - Run TypeScript type checking
- `npm run clean` - Clean build directory

### Project Structure

```
TAPT-V6/
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── forms/         # Form components with Turnstile
│   │   ├── ui/            # Basic UI components
│   │   └── ...
│   ├── pages/             # Page components
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utility libraries
│   ├── config/            # Configuration files
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Helper functions
├── supabase/
│   ├── functions/         # Edge Functions
│   └── migrations/        # Database migrations
├── public/                # Static assets
└── ...
```

## 🔒 Security Implementation

### Cloudflare Turnstile
All public forms are protected with Cloudflare Turnstile:
- Contact forms
- Registration forms
- Nomination forms
- Membership applications

### Security Features
- ✅ Server-side token verification
- ✅ Rate limiting (5 attempts per 15 minutes)
- ✅ Domain validation
- ✅ CORS protection
- ✅ Input sanitization
- ✅ SQL injection prevention

## 🌐 Deployment

### Frontend Deployment

The application can be deployed to any static hosting provider:

**Vercel:**
```bash
npm install -g vercel
vercel --prod
```

**Netlify:**
```bash
npm run build
# Upload dist/ folder to Netlify
```

### Backend Deployment (Supabase Edge Functions)

1. **Deploy functions**
```bash
npx supabase functions deploy
```

2. **Set environment variables**
```bash
npx supabase secrets set TURNSTILE_SECRET_KEY=your_secret_key
npx supabase secrets set ENVIRONMENT=production
```

3. **Test deployment**
```bash
npx supabase functions logs submit-contact-message
```

## 🧪 Testing

### Manual Testing Checklist

#### Frontend
- [ ] All pages load correctly
- [ ] Forms display Turnstile widget
- [ ] Form submissions work
- [ ] Error handling works
- [ ] Mobile responsiveness

#### Security
- [ ] Turnstile verification required
- [ ] Rate limiting functions
- [ ] CORS restrictions work
- [ ] Invalid tokens rejected

#### Cross-Browser
- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Safari
- [ ] Mobile browsers

## 🔧 Configuration

### Domain Configuration

Update allowed domains in:
- `src/config/turnstile.ts`
- `supabase/functions/*/index.ts` (CORS settings)

### Turnstile Configuration

1. **Cloudflare Dashboard**
   - Add your domains to Turnstile site settings
   - Configure security levels

2. **Environment Variables**
   - Frontend: `VITE_TURNSTILE_SITE_KEY`
   - Backend: `TURNSTILE_SECRET_KEY`

## 📊 Monitoring

### Logs and Analytics
- Supabase function logs
- Browser console errors
- Form submission rates
- Security events

### Performance
- Build size analysis
- Core Web Vitals
- API response times

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

### Code Style
- Use TypeScript for all new code
- Follow ESLint and Prettier configurations
- Add proper type definitions
- Include error handling

## 📞 Support

For issues and questions:
1. Check the documentation
2. Review browser/server logs
3. Test with the Turnstile test component
4. Contact the development team

## 📄 License

MIT License - see LICENSE file for details.

---

**Security Note**: This application prioritizes security with comprehensive input validation, rate limiting, and bot protection. Never bypass security measures for convenience.