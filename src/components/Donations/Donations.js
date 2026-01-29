import React from 'react';

export default function Donations() {
  return (
    <div className="bg-primary-50 min-h-screen">
      <div className="py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold tracking-tight text-primary-600 sm:text-5xl font-serif">
              Support The Kathryn Classic
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600 font-serif">
              Your donation helps fund CJD research and raises awareness for Creutzfeldt-Jakob disease.
              All donations are tax-deductible and go directly to the CJD Foundation.
            </p>
          </div>

          {/* Donation Information Card */}
          <div className="mb-8">
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="text-center">
                <p className="text-base leading-7 text-gray-600 font-serif">
                  We welcome donations of any amount. Most of our supporters contribute around $100,
                  with contributions ranging from small gifts to $500 or more. Every donation makes a difference
                  in funding research and supporting families affected by CJD.
                </p>
              </div>
            </div>
          </div>

          {/* Donation Button Card */}
          <div className="mb-8">
            <div className="bg-white rounded-2xl shadow-lg p-12">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-primary-600 mb-4 font-serif">Make a Donation Today</h2>
                <p className="text-base text-gray-600 mb-8 max-w-xl mx-auto font-serif">
                  Your contribution supports vital research and provides critical resources for families affected by Creutzfeldt-Jakob disease.
                </p>
                <a
                  href="https://secure.qgiv.com/event/cjdfoundation/account/2161631/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-8 py-4 text-lg font-semibold text-white shadow-lg hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 transition-all hover:scale-105"
                >
                  Donate to CJD Foundation
                  <svg className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </a>
                <p className="mt-4 text-sm text-gray-600 font-serif">
                  Opens in a new window
                </p>
              </div>
            </div>
          </div>

          {/* About CJD Foundation Card */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-primary-600 text-center mb-6 font-serif">About the CJD Foundation</h2>

            <div className="space-y-4 text-base leading-7 text-gray-600 font-serif">
              <p>
                The CJD Foundation is a registered 501(c)(3) non-profit organization dedicated to supporting families affected by prion disease,
                specifically Creutzfeldt-Jakob Disease (CJD). The foundation has earned a 4-Star Rating from Charity Navigator.
              </p>

              <div className="mt-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">What They Do</h3>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-900">Direct Family Support:</h4>
                    <ul className="list-disc list-inside space-y-1 mt-2">
                      <li>Operate a toll-free helpline (1-800-659-1991) available 7 days a week</li>
                      <li>Offer referrals, support groups, and educational webinars</li>
                      <li>Host an annual family conference bringing together affected families and medical experts</li>
                      <li>Provide end-of-life planning resources and caregiver support</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900">Research & Education:</h4>
                    <ul className="list-disc list-inside space-y-1 mt-2">
                      <li>Award research grants through their Family Memorial Research Grants program</li>
                      <li>Partner with scientists and clinicians on prion disease research</li>
                      <li>Educate medical professionals, funeral professionals, and caregivers</li>
                      <li>Collaborate with international patient associations and health authorities</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900">Advocacy:</h4>
                    <ul className="list-disc list-inside space-y-1 mt-2">
                      <li>Maintain a memory quilt tribute to those affected</li>
                      <li>Operate a prion disease registry</li>
                      <li>Conduct advocacy initiatives in Washington, D.C.</li>
                    </ul>
                  </div>
                </div>
              </div>

              <p className="mt-6 text-base bg-primary-50 p-4 rounded-lg border border-primary-200">
                <strong>The Need:</strong> In the United States, approximately 500 new CJD cases are diagnosed annually,
                with a global incidence of one to two cases per million people per year. Your generous donations help continue
                vital research into finding treatments and ultimately a cure for this devastating disease.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
