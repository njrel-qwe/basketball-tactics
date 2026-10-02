# kotlinx.serialization
-keepattributes *Annotation*, InnerClasses
-keepclassmembers @kotlinx.serialization.Serializable class com.coach.tacticboard.** {
    *** Companion;
    kotlinx.serialization.KSerializer serializer(...);
}
