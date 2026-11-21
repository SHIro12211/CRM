# 🎓 Client & Course Insights – Academy CRM

This web application project manages an academy's clients, courses, enrollments and payments to organize daily operations, understand student progress, and support data-driven decisions.

---

## 📌 Project Goals

- Identify the clients, courses and enrollments that drive the academy.
- Analyze which advisors manage each client and how students progress.
- Detect payment, debt and follow-up patterns and trends.
- Visualize key metrics for better business understanding.

---

## 🗂️ Project Structure

```
project-name/

│

├── app/                  # Nuxt application: pages, components and composables

├── supabase/             # Edge Functions for create, update and delete

├── public/               # Static files

├── .env.example          # Example environment variables

└── README.md             # This file

```

---

## 🧪 Tools and Technologies

- Nuxt 4, Vue 3

- TypeScript

- Nuxt UI, Tailwind CSS

- Supabase, PostgreSQL

- Git & GitHub

---

## 📊 Dataset

- Source: Supabase project database (PostgreSQL) with Row Level Security (RLS)

- Size: 12 tables

- Key variables: `users`, `clients`, `courses`, `topics`, `enrollments`, `topic_progress`, `payments`, `follow_ups`, `user_types`, `client_statuses`, `follow_up_types`, `payment_methods`

---

## 📈 Analysis Overview

1. **Management Modules**:

   - Handled users, clients, courses and topics

   - Analyzed enrollments and topic progress by student

   - Payments and follow-ups per client and advisor

2. **Key Visualizations**:

   - Active advisors, students, enrollments and income on the Home

   - Top 5 best-selling courses and sales donut by course

   - Sales bars by month and next 10 follow-ups

3. **Business Insights**:

   - Most operations are managed by advisors with their own clients only, under four roles: Admin, Head Advisor, Advisor and Client.

   - A payment cannot exceed the pending balance, and only `Parcial` enrollments count toward a client's debt.

   - Clients see only their own courses, progress, payments and next follow-up.

---

## 🧠 Conclusions

- Daily operations should be centralized in the CRM instead of separate lists.

- While popular courses sell more units, the Home shows which courses generate the most income.

- A follow-up strategy could increase revenue from enrolled clients.

---

## 📈 Future Improvements

The project is under active development and has room to grow in scope and complexity:

1. **More statistical analysis**:

   - Student retention and completion rate per course.
   - Revenue per advisor, per course and per month.
   - Churn prediction: which students are at risk of not finishing.
   - Average time to complete a course and conversion funnel (follow-up → enrollment → full payment).

2. **More features**:

   - Automatic payment and follow-up reminders (email and WhatsApp).
   - Certificates on course completion.
   - Exportable reports in PDF and Excel.
   - Advanced filters and global search in the dashboard.

3. **More technical complexity**:

   - Automated tests (unit and end-to-end).
   - Continuous deployment (CI/CD) and automatic backups.
   - Change auditing and activity log per user.
   - Integration with a payment gateway.

---

## 🚀 How to Run the Project

1. Clone the repository:

   ```
   git clone <repository-url>

   cd your-repo-name
   ```

2. Create your environment file:

   ```
   cp .env.example .env
   ```

   Complete `NUXT_PUBLIC_SUPABASE_URL` and `NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env`.

3. Install the dependencies:

   ```
   npm install
   ```

4. Load the test data (optional):

   The repository includes CSV files with sample data (users, clients, courses, enrollments, payments and follow-ups) that you can import into Supabase to try the CRM without real data.

5. Run the development server:

   ```
   npm run dev
   ```

   Open http://localhost:3000

---

## 📬 Contact

- 👤 Author: SHIro1221

- 📧 Email: labrada.rouco@gmail.com

- 🌐 GitHub: https://github.com/SHIro12211
