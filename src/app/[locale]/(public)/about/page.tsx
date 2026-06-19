import { AboutPageContent } from "@/components/features/about/AboutPageContent";
import Footer from "@/components/layout/Footer.jsx";
import { PublicNavbar } from "@/components/layout/PublicNavbar";

export default function AboutPage() {
  return (
    <>
      <PublicNavbar />
      <AboutPageContent />
      <Footer />
    </>
  );
}
