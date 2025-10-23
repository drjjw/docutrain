// Fun medical facts about kidneys and urine
export const kidneyFacts = [
    "Renal function can be maintained with a single kidney – unilateral nephrectomy patients typically experience normal renal capacity.",
    "The kidneys process approximately 180-200 liters of blood daily – filtering plasma through glomerular capillaries continuously.",
    "Adult kidneys measure 10-12 cm in length and weigh approximately 125-170 grams – roughly the size of a clenched fist.",
    "The right kidney sits approximately 2-3 cm lower than the left – displaced inferiorly by the hepatic mass.",
    "Kidneys regulate systemic blood pressure via the renin-angiotensin-aldosterone system – producing vasoactive hormones that control vascular tone.",
    "Each kidney contains approximately 1-1.5 million functional nephrons – the fundamental filtration units of renal tissue.",
    "Renal regulation maintains blood pH between 7.35-7.45 – through bicarbonate reabsorption and hydrogen ion secretion.",
    "Kidneys produce erythropoietin in response to hypoxia – stimulating erythropoiesis in bone marrow to increase red blood cell production.",
    "The first successful renal allograft was performed in 1954 – between identical twins, eliminating rejection concerns.",
    "Excessive fluid intake can cause hyponatremia and renal water overload – though acute water intoxication remains clinically uncommon.",
    "Renal blood flow represents approximately 20-25% of cardiac output – processing the entire circulatory volume multiple times hourly.",
    "Kidneys activate vitamin D to its functional form, calcitriol – essential for calcium homeostasis and osseous mineralization.",
    "Renal arteries deliver 1-1.2 liters of blood per minute to the kidneys – despite renal tissue comprising less than 1% of total body mass.",
    "Ancient Egyptian mummification practices preserved renal tissue in situ – unlike eviscerated abdominal organs placed in canopic jars.",
    "Nephrolithiasis has been documented in paleontological specimens – with renal calculi found in remains dating to 5000 BCE.",
    "The kidneys demonstrate rapid physiological adaptation to dietary intake – adjusting filtration and reabsorption within minutes of consumption.",
    "Renal tubules regulate electrolyte homeostasis – maintaining serum concentrations of sodium, potassium, calcium, and phosphate.",
    "Ureters conduct urine via peristaltic contractions – smooth muscle waves propel urine from renal pelvis to bladder.",
    "Daily urine output typically ranges from 800-2000 ml – concentrating metabolic waste products and excess solutes.",
    "Chronic volume depletion increases urinary supersaturation – elevating nephrolithiasis risk through crystal precipitation."
];

export const urineFacts = [
    "Average daily urine output ranges from 1-2 liters – representing normal renal excretory function in euvolemic adults.",
    "Urine composition is approximately 95% water – with the remaining 5% consisting of urea, creatinine, electrolytes, and metabolic byproducts.",
    "Fresh urine is sterile in healthy individuals – bacterial colonization occurs only after voiding or in cases of urinary tract infection.",
    "Urochrome pigment produces characteristic yellow coloration – a byproduct of hemoglobin catabolism and bilirubin metabolism.",
    "Glomerular filtration processes approximately 180 liters of plasma daily – with 99% undergoing tubular reabsorption, yielding 1-2 liters of urine.",
    "Ancient Romans utilized urine's ammonia content for oral hygiene – though modern dental practices have replaced this antiquated method.",
    "Urine served as a historical source of potassium nitrate – utilized in gunpowder synthesis before industrial production methods.",
    "ISS water recovery systems reclaim approximately 90% of water from urine – through advanced filtration and purification protocols.",
    "Urine specific gravity correlates with hydration status – hypotonic urine indicates adequate hydration while hypertonic suggests volume depletion.",
    "Nocturnal antidiuretic hormone secretion reduces nighttime urine production – concentrating urine and decreasing voiding frequency during sleep.",
    "Bladder capacity typically ranges from 400-600 milliliters – though functional capacity varies with individual physiology.",
    "Detrusor muscle control eventually fails under prolonged distension – resulting in involuntary micturition when voluntary retention exceeds physiological limits.",
    "Urine contains significant concentrations of nitrogen, phosphorus, and potassium – making it effective as agricultural fertilizer.",
    "Initial micturition urgency occurs at approximately 50% bladder capacity – typically around 200-300 milliliters of accumulation.",
    "Cold-induced diuresis results from peripheral vasoconstriction – increasing central blood volume and triggering increased renal filtration.",
    "Asparagusic acid metabolism produces volatile sulfur compounds – detectable in urine within 15-30 minutes, though genetic polymorphisms affect olfactory detection.",
    "Ammonia in urine facilitated historical leather tanning processes – softening and preserving animal hides through chemical modification.",
    "Diurnal variation affects urine concentration – first morning void demonstrates maximal specific gravity due to overnight fluid conservation.",
    "Normal voiding frequency ranges from 4-10 times per 24-hour period – with 6-8 micturitions representing typical patterns.",
    "Maximum urinary flow velocity can reach 3 meters per second – varying with voiding pressure and urethral diameter.",
    "Glycosuria served as a diagnostic indicator for diabetes mellitus – before modern serum glucose and HbA1c testing became available.",
    "Chronic urinary retention can cause detrusor muscle dysfunction – impairing bladder contractility and complete evacuation.",
    "Urine contains over 3,000 distinct metabolites – reflecting comprehensive renal filtration and metabolic excretion.",
    "The term 'urine' derives from Latin 'urina' – with linguistic roots dating to ancient Roman medical terminology.",
    "Diuretic substances increase renal water excretion – caffeine and ethanol inhibit antidiuretic hormone, promoting polyuria.",
    "Renal function operates continuously without circadian interruption – maintaining constant blood filtration and homeostasis.",
    "Urinary pH typically ranges from 4.5-8.0 – influenced by dietary acid-base load and renal compensatory mechanisms.",
    "Ammonia in urine served as a mordant in textile dyeing – fixing pigments through chemical binding to fabric fibers.",
    "Supine positioning increases renal perfusion pressure – enhancing glomerular filtration rate and urine production during recumbency.",
    "Urine was utilized in early photographic development – silver salts combined with urinary compounds facilitated image fixation.",
    "Bladder wall compliance allows distension to twice resting volume – though excessive distension causes discomfort and tissue damage.",
    "Fetal micturition begins around 10-11 weeks gestation – contributing significantly to amniotic fluid volume in the second and third trimesters.",
    "Urine freezing point depression occurs due to dissolved solutes – lowering the crystallization temperature below 0°C.",
    "Alchemical experimentation with urine led to phosphorus discovery in 1669 – though gold extraction attempts proved unsuccessful.",
    "Psychogenic urinary frequency results from autonomic nervous system activation – stress and anxiety trigger detrusor overactivity independent of bladder volume."
];

// Combine all facts
export const allFacts = [...kidneyFacts, ...urineFacts];

// Get a random prefix
function getRandomPrefix() {
    const prefixes = ["<strong>Fun fact:</strong> ", "<strong>Did you know?</strong> "];
    return prefixes[Math.floor(Math.random() * prefixes.length)];
}

// Get a random fact with prefix (owner-aware)
export function getRandomFact(owner = null) {
    // Only show fun facts for ukidney documents
    if (owner !== 'ukidney') {
        return null; // No fact for non-ukidney documents
    }

    const fact = allFacts[Math.floor(Math.random() * allFacts.length)];
    return getRandomPrefix() + fact;
}

