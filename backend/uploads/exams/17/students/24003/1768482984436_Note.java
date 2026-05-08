public class Note{
    private Etudiant etudiant,ElementModule elementModule,float moyenne;
    public Note(Etudiant etudiant, ElementModule elementModule, float moyenne){
        this.etudiant = etudiant;
        this.elementModule = elementModule;
        this.moyenne = moyenne;
    }
    public Etudiant getEtudiant(){
        return this.etudiant;
    }
    public ElementModule getElementModule(){
        return this.elementModule;
    }
    public float getMoyenne(){
        return this.moyenne;
    }
}